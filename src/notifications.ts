import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';
import { Platform } from 'react-native';

// Canal de alta prioridade para os lembretes que devem tocar como chamada.
const CALL_CHANNEL = 'bill-call';
const NORMAL_CHANNEL = 'bill-default';

// No modo chamada, o Bill toca de novo depois destes segundos, até você tocar na notificação.
const CALL_RETRIES_SECONDS = [30, 60];

// No Expo Go, a criação de canais quebra no código nativo dele; lá usamos o canal padrão.
const isExpoGo = Constants.executionEnvironment === 'storeClient';

const readyChannels = new Set<string>();

async function createChannel(id: string, options: Notifications.NotificationChannelInput) {
  try {
    await Notifications.setNotificationChannelAsync(id, options);
    readyChannels.add(id);
  } catch (error) {
    console.warn(`Não consegui criar o canal ${id}`, error);
  }
}

export async function setupNotifications(): Promise<boolean> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  // 1. Permissão primeiro: sem ela o Android bloqueia todas as notificações.
  let granted = false;
  try {
    const current = await Notifications.getPermissionsAsync();
    granted = current.granted;
    if (!granted) {
      const asked = await Notifications.requestPermissionsAsync();
      granted = asked.granted;
    }
  } catch (error) {
    console.warn('Falha ao pedir permissão de notificação', error);
  }

  // 2. Canais (só fora do Expo Go). Sem a opção "sound": o Expo trata qualquer valor ali
  // como arquivo de som próprio, e o canal já usa o som padrão do Android.
  if (Platform.OS === 'android' && !isExpoGo) {
    await createChannel(CALL_CHANNEL, {
      name: 'Lembretes que tocam como chamada',
      importance: AndroidImportance.MAX,
      vibrationPattern: [0, 1000, 500, 1000, 500, 1000],
      lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
    });
    await createChannel(NORMAL_CHANNEL, {
      name: 'Lembretes',
      importance: AndroidImportance.HIGH,
      vibrationPattern: [0, 400, 200, 400],
    });
  }

  return granted;
}

export async function notificationsAllowed(): Promise<boolean> {
  try {
    return (await Notifications.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

// "Alarmes e lembretes" do Android: sem essa permissão, o Android pode atrasar o lembrete vários minutos.
export async function exactAlarmsAllowed(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    return (await Notifications.getExactAlarmPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

// Abre a tela do sistema para liberar "Alarmes e lembretes" e devolve se foi liberado.
export async function requestExactAlarms(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    return (await Notifications.requestExactAlarmPermissionsAsync()).granted;
  } catch (error) {
    console.warn('Falha ao pedir permissão de alarmes exatos', error);
    return false;
  }
}

function channelFor(asCall: boolean): string | undefined {
  const wanted = asCall ? CALL_CHANNEL : NORMAL_CHANNEL;
  // Se o canal não existir, deixa o Expo usar o canal padrão em vez de a notificação sumir.
  return readyChannels.has(wanted) ? wanted : undefined;
}

async function scheduleOne(title: string, body: string, when: Date, asCall: boolean, itemId: number) {
  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.MAX,
      data: { asCall, itemId },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: when,
      channelId: channelFor(asCall),
      // Agenda como despertador: o Android não adia esse tipo de alarme (precisa de "Alarmes e lembretes").
      delivery: 'alarmClock',
    },
  });
}

// Agenda o lembrete. Devolve os ids separados por vírgula (no modo chamada há repetições).
export async function scheduleReminder(
  title: string,
  body: string,
  when: Date,
  asCall: boolean,
  itemId: number,
): Promise<string> {
  const ids = [await scheduleOne(title, body, when, asCall, itemId)];
  if (asCall) {
    for (const seconds of CALL_RETRIES_SECONDS) {
      const retryAt = new Date(when.getTime() + seconds * 1000);
      ids.push(await scheduleOne(title, `${body} (chamando de novo)`, retryAt, true, itemId));
    }
  }
  return ids.join(',');
}

export async function cancelReminder(notificationIds: string | null) {
  if (!notificationIds) return;
  for (const id of notificationIds.split(',')) {
    if (!id) continue;
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      // Já disparou ou já foi cancelada.
    }
  }
}
