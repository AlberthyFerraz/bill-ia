import { addCalendarEvent, requestCalendarAccess } from './calendar';
import { Item, getSetting, insertItem, listItems, setItemFields } from './db';
import { exactAlarmsAllowed, notificationsAllowed, scheduleReminder } from './notifications';
import { parseRequest } from './parser';

const KIND_NAME = { task: 'a tarefa', reminder: 'o lembrete', event: 'o compromisso' } as const;

export function formatWhen(date: Date, now: Date = new Date()): string {
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (sameDay(date, now)) return `hoje às ${time}`;
  if (sameDay(date, tomorrow)) return `amanhã às ${time}`;
  const day = date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
  return `${day} às ${time}`;
}

function minutesUntil(date: Date, now: Date): string {
  const min = Math.round((date.getTime() - now.getTime()) / 60000);
  if (min < 60) return `daqui ${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h < 24) return m ? `daqui ${h}h${String(m).padStart(2, '0')}` : `daqui ${h}h`;
  return '';
}

function isQuestionAboutAgenda(text: string): 'today' | 'tomorrow' | 'pending' | null {
  const t = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (/\b(o que|oq|quais?)\b.*\b(amanha)\b/.test(t)) return 'tomorrow';
  if (/\b(o que|oq|quais?|minha|meus|minhas)\b.*\b(hoje|agenda|compromissos?)\b/.test(t)) return 'today';
  if (/\b(pendentes?|minhas tarefas|lista de tarefas|o que falta)\b/.test(t)) return 'pending';
  return null;
}

function describeList(items: Item[], empty: string): string {
  if (items.length === 0) return empty;
  return items
    .map((i) => `• ${i.title}${i.when_at ? ` (${formatWhen(new Date(i.when_at))})` : ''}`)
    .join('\n');
}

// Recebe a frase do usuário, cria o item se fizer sentido e devolve a resposta do Bill.
export async function handleMessage(text: string, forceCall = false): Promise<string> {
  const now = new Date();

  const question = isQuestionAboutAgenda(text);
  if (question) {
    const items = (await listItems()).filter((i) => !i.done);
    if (question === 'pending') {
      return describeList(items, 'Você não tem nada pendente. 🎉');
    }
    const target = new Date(now);
    if (question === 'tomorrow') target.setDate(now.getDate() + 1);
    const sameDay = items.filter((i) => {
      if (!i.when_at) return false;
      const d = new Date(i.when_at);
      return d.toDateString() === target.toDateString();
    });
    return describeList(
      sameDay,
      question === 'today' ? 'Nada marcado para hoje.' : 'Nada marcado para amanhã.',
    );
  }

  const parsed = parseRequest(text, now);
  const asCall = parsed.asCall || forceCall;

  if (parsed.when && parsed.when.getTime() <= now.getTime()) {
    return 'Esse horário já passou. Me diga outro, por exemplo "daqui 10 minutos" ou "amanhã às 9".';
  }

  const finalKind = parsed.when ? parsed.kind : parsed.kind === 'event' ? 'event' : 'task';
  const id = await insertItem({
    kind: finalKind,
    title: parsed.title,
    notes: null,
    when_at: parsed.when ? parsed.when.toISOString() : null,
    as_call: asCall ? 1 : 0,
  });

  if (!parsed.when) {
    return `Anotei ${KIND_NAME[finalKind]} "${parsed.title}". Se quiser que eu te avise, diga quando, por exemplo "amanhã às 9".`;
  }

  const notificationId = await scheduleReminder(
    asCall ? '📞 Bill está te chamando' : 'Lembrete do Bill',
    parsed.title,
    parsed.when,
    asCall,
    id,
  );
  await setItemFields(id, { notification_id: notificationId });

  let calendarNote = '';
  if ((await getSetting('save_to_calendar')) === '1' && (await requestCalendarAccess())) {
    const eventId = await addCalendarEvent(parsed.title, null, parsed.when);
    if (eventId) {
      await setItemFields(id, { calendar_event_id: eventId });
      calendarNote = ' Também salvei no calendário do celular.';
    }
  }

  const rel = minutesUntil(parsed.when, now);
  const how = asCall ? 'Vou tocar como chamada' : 'Vou te lembrar';
  const blocked = (await notificationsAllowed())
    ? ''
    : '\n\n⚠️ As notificações estão bloqueadas, então eu não vou conseguir tocar. Libere em Configurações > Apps > Expo Go > Notificações.';
  const late =
    blocked || (await exactAlarmsAllowed())
      ? ''
      : '\n\nObs.: sem a permissão "Alarmes e lembretes" posso tocar alguns minutos atrasado. Dá para liberar no Perfil.';
  return `Combinado! ${how} de "${parsed.title}" ${formatWhen(parsed.when, now)}${rel ? ` (${rel})` : ''}.${calendarNote}${blocked}${late}`;
}
