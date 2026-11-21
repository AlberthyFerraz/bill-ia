import * as Calendar from 'expo-calendar/legacy';
import { Platform } from 'react-native';

// Usa o calendário do próprio celular (Google Agenda, Samsung, etc., conforme o aparelho).
export async function requestCalendarAccess(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === 'granted';
}

async function defaultCalendarId(): Promise<string | null> {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const writable = calendars.filter((c) => c.allowsModifications);
  const preferred = writable.find((c) => c.isPrimary) ?? writable[0];
  return preferred ? preferred.id : null;
}

// Cria um evento de 30 minutos no calendário do celular e devolve o id do evento.
export async function addCalendarEvent(title: string, notes: string | null, start: Date): Promise<string | null> {
  const calendarId = await defaultCalendarId();
  if (!calendarId) return null;
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  return Calendar.createEventAsync(calendarId, {
    title,
    notes: notes ?? undefined,
    startDate: start,
    endDate: end,
    alarms: [{ relativeOffset: 0, method: Calendar.AlarmMethod.ALERT }],
  });
}

export async function removeCalendarEvent(eventId: string | null) {
  if (!eventId) return;
  await Calendar.deleteEventAsync(eventId);
}

export interface DeviceEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
}

// Lê os eventos de todos os calendários do celular no intervalo.
export async function listDeviceEvents(start: Date, end: Date): Promise<DeviceEvent[]> {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  if (calendars.length === 0) return [];
  const events = await Calendar.getEventsAsync(
    calendars.map((c) => c.id),
    start,
    end,
  );
  return events.map((e) => ({
    id: e.id,
    title: e.title || '(sem título)',
    start: new Date(e.startDate),
    end: new Date(e.endDate),
    allDay: !!e.allDay,
  }));
}

export async function hasCalendarAccess(): Promise<boolean> {
  const { status } = await Calendar.getCalendarPermissionsAsync();
  return status === 'granted';
}
