import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Keyboard, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { BottomBar, TabKey } from './src/components/BottomBar';
import { LoadingScreen } from './src/components/LoadingScreen';
import { Item, getSetting, listItems, setItemFields, setSetting } from './src/db';
import { cancelReminder, exactAlarmsAllowed, requestExactAlarms, setupNotifications } from './src/notifications';
import { AgendaScreen } from './src/screens/AgendaScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { RemindersScreen } from './src/screens/RemindersScreen';
import { colors } from './src/theme';

// Mantém a abertura nativa até a abertura animada do Bill.ia aparecer (evita um flash branco).
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [tab, setTab] = useState<TabKey>('chat');
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState('');
  const [ready, setReady] = useState(false);
  const [showLoading, setShowLoading] = useState(true);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const refresh = useCallback(async () => {
    setItems(await listItems());
  }, []);

  // Com o teclado aberto, esconde a barra de abas para sobrar espaço para a conversa.
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Carrega os dados enquanto a abertura está na tela.
  useEffect(() => {
    Promise.all([listItems(), getSetting('user_name')])
      .then(([loaded, savedName]) => {
        setItems(loaded);
        setName(savedName ?? '');
      })
      .catch((error) => console.warn('Falha ao carregar dados', error))
      .finally(() => setReady(true));

    // Ao tocar na notificação de chamada, para de insistir.
    const sub = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const itemId = response.notification.request.content.data?.itemId;
      if (typeof itemId !== 'number') return;
      const item = (await listItems()).find((i) => i.id === itemId);
      if (item?.notification_id) {
        await cancelReminder(item.notification_id);
        await setItemFields(item.id, { notification_id: null });
        refresh();
      }
    });
    return () => sub.remove();
  }, [refresh]);

  // Permissões só depois da abertura, para os avisos não aparecerem por cima dela.
  useEffect(() => {
    if (showLoading) return;
    (async () => {
      await setupNotifications();
      // Sem "Alarmes e lembretes" o Android pode atrasar os lembretes. Explica uma vez e oferece liberar.
      if (!(await exactAlarmsAllowed()) && (await getSetting('exact_alarm_asked')) !== '1') {
        await setSetting('exact_alarm_asked', '1');
        Alert.alert(
          'Tocar no horário certo',
          'Para o Bill te avisar no minuto exato, o Android precisa da permissão "Alarmes e lembretes". Sem ela, o aviso pode atrasar alguns minutos.',
          [
            { text: 'Agora não', style: 'cancel' },
            { text: 'Liberar', onPress: () => requestExactAlarms() },
          ],
        );
      }
    })();
  }, [showLoading]);

  const hideNativeSplash = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);
  const finishLoading = useCallback(() => setShowLoading(false), []);

  async function changeName(n: string) {
    setName(n);
    await setSetting('user_name', n);
  }

  const now = new Date();
  const pendingToday = items.filter(
    (i) => !i.done && i.when_at && new Date(i.when_at).toDateString() === now.toDateString(),
  ).length;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <View style={{ flex: 1 }}>
          {tab === 'chat' && (
            <ChatScreen
              name={name}
              pendingToday={pendingToday}
              onOpenReminders={() => setTab('reminders')}
              onOpenAgenda={() => setTab('agenda')}
              onItemsChanged={refresh}
            />
          )}
          {tab === 'reminders' && <RemindersScreen items={items} onChanged={refresh} />}
          {tab === 'agenda' && <AgendaScreen items={items} />}
          {tab === 'profile' && <ProfileScreen name={name} onNameChange={changeName} />}
        </View>
        {!keyboardOpen && <BottomBar active={tab} onChange={setTab} />}
      </SafeAreaView>
      {showLoading && <LoadingScreen ready={ready} onFinish={finishLoading} onShown={hideNativeSplash} />}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
});
