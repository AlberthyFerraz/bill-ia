import Ionicons from '@expo/vector-icons/Ionicons';
import { Alert, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { formatWhen } from '../actions';
import { removeCalendarEvent } from '../calendar';
import { Item, deleteItem, setItemFields } from '../db';
import { cancelReminder } from '../notifications';
import { colors, radius } from '../theme';

const KIND_ICON: Record<Item['kind'], keyof typeof Ionicons.glyphMap> = {
  task: 'checkbox-outline',
  reminder: 'alarm-outline',
  event: 'people-outline',
};

export function RemindersScreen({ items, onChanged }: { items: Item[]; onChanged: () => void }) {
  const pending = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);
  const sections = [
    { title: 'Pendentes', data: pending },
    ...(done.length ? [{ title: 'Concluídos', data: done }] : []),
  ];

  async function toggle(item: Item) {
    await setItemFields(item.id, { done: item.done ? 0 : 1 });
    if (!item.done) {
      await cancelReminder(item.notification_id);
      await setItemFields(item.id, { notification_id: null });
    }
    onChanged();
  }

  function confirmDelete(item: Item) {
    Alert.alert('Apagar?', item.title, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          await cancelReminder(item.notification_id);
          await removeCalendarEvent(item.calendar_event_id);
          await deleteItem(item.id);
          onChanged();
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.title}>Lembretes e tarefas</Text>
      <SectionList
        sections={sections}
        keyExtractor={(i) => String(i.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title}</Text>}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => toggle(item)}
            onLongPress={() => confirmDelete(item)}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
          >
            <Ionicons
              name={item.done ? 'checkmark-circle' : KIND_ICON[item.kind]}
              size={24}
              color={item.done ? colors.muted : colors.accent}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, item.done ? styles.doneText : null]}>{item.title}</Text>
              {item.when_at ? (
                <Text style={styles.rowMeta}>
                  {item.as_call ? '📞 ' : ''}
                  {formatWhen(new Date(item.when_at))}
                </Text>
              ) : (
                <Text style={styles.rowMeta}>sem horário</Text>
              )}
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>Nada por aqui. Peça ao Bill na conversa, por exemplo “me lembra de beber água daqui 30 minutos”.</Text>
        }
        ListFooterComponent={
          items.length ? <Text style={styles.hint}>Toque para concluir · Segure para apagar</Text> : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 22, fontWeight: '700', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  section: { color: colors.muted, fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 8, textTransform: 'uppercase' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowTitle: { color: colors.text, fontSize: 16 },
  rowMeta: { color: colors.muted, fontSize: 13, marginTop: 2 },
  doneText: { textDecorationLine: 'line-through', color: colors.muted },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 48, paddingHorizontal: 24, lineHeight: 21 },
  hint: { color: colors.muted, textAlign: 'center', fontSize: 12, marginTop: 8 },
});
