import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { DeviceEvent, hasCalendarAccess, listDeviceEvents, requestCalendarAccess } from '../calendar';
import { Item } from '../db';
import { colors, radius } from '../theme';

interface Entry {
  key: string;
  title: string;
  start: Date;
  source: 'bill' | 'phone';
  asCall: boolean;
  allDay: boolean;
}

const DAYS_AHEAD = 7;

// Lê a permissão e os eventos do calendário do celular para os próximos dias.
async function fetchPhoneAgenda(): Promise<{ access: boolean; events: DeviceEvent[] }> {
  let access = false;
  try {
    access = await hasCalendarAccess();
  } catch {
    access = false;
  }
  if (!access) return { access, events: [] };
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + DAYS_AHEAD);
  try {
    return { access, events: await listDeviceEvents(start, end) };
  } catch {
    return { access, events: [] };
  }
}

export function AgendaScreen({ items }: { items: Item[] }) {
  const [access, setAccess] = useState<boolean | null>(null);
  const [phoneEvents, setPhoneEvents] = useState<DeviceEvent[]>([]);

  const apply = useCallback((r: { access: boolean; events: DeviceEvent[] }) => {
    setAccess(r.access);
    setPhoneEvents(r.events);
  }, []);

  useEffect(() => {
    let active = true;
    fetchPhoneAgenda().then((r) => {
      if (active) apply(r);
    });
    return () => {
      active = false;
    };
  }, [apply]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limit = new Date(today);
  limit.setDate(today.getDate() + DAYS_AHEAD);

  // Itens do Bill que já foram salvos no calendário aparecem só uma vez.
  const billCalendarIds = new Set(items.map((i) => i.calendar_event_id).filter(Boolean));
  const entries: Entry[] = [
    ...items
      .filter((i) => !i.done && i.when_at)
      .map((i) => ({
        key: `b${i.id}`,
        title: i.title,
        start: new Date(i.when_at as string),
        source: 'bill' as const,
        asCall: !!i.as_call,
        allDay: false,
      })),
    ...phoneEvents
      .filter((e) => !billCalendarIds.has(e.id))
      .map((e) => ({ key: `p${e.id}${e.start.getTime()}`, title: e.title, start: e.start, source: 'phone' as const, asCall: false, allDay: e.allDay })),
  ]
    .filter((e) => e.start >= today && e.start < limit)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const groups = new Map<string, Entry[]>();
  for (const e of entries) {
    const label = dayLabel(e.start, today);
    groups.set(label, [...(groups.get(label) ?? []), e]);
  }
  const sections = [...groups.entries()].map(([title, data]) => ({ title, data }));

  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.title}>Próximos 7 dias</Text>
      {access === false && (
        <Pressable
          onPress={async () => {
            if (await requestCalendarAccess()) apply(await fetchPhoneAgenda());
          }}
          style={({ pressed }) => [styles.permission, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name="calendar" size={20} color={colors.onAccent} />
          <Text style={styles.permissionText}>Mostrar também os eventos do calendário do celular</Text>
        </Pressable>
      )}
      <SectionList
        sections={sections}
        keyExtractor={(e) => e.key}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title}</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.time}>
              {item.allDay ? 'dia todo' : item.start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowMeta}>
                {item.source === 'bill' ? (item.asCall ? '📞 Bill · chamada' : 'Bill') : 'Calendário do celular'}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Nada marcado para os próximos dias.</Text>}
      />
    </View>
  );
}

function dayLabel(d: Date, today: Date): string {
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Amanhã';
  const s = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 22, fontWeight: '700', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  permission: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.accent,
    borderRadius: radius.card,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
  },
  permissionText: { color: colors.onAccent, fontSize: 14, fontWeight: '600', flex: 1 },
  section: { color: colors.muted, fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 8, textTransform: 'uppercase' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  time: { color: colors.text, fontSize: 15, fontWeight: '700', width: 64 },
  rowTitle: { color: colors.text, fontSize: 16 },
  rowMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 48 },
});
