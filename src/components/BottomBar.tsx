import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radius } from '../theme';

export type TabKey = 'chat' | 'reminders' | 'agenda' | 'profile';

const TABS: { key: TabKey; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { key: 'chat', icon: 'chatbubble-ellipses', label: 'Conversa' },
  { key: 'reminders', icon: 'alarm-outline', label: 'Lembretes' },
  { key: 'agenda', icon: 'calendar-outline', label: 'Agenda' },
  { key: 'profile', icon: 'person-outline', label: 'Perfil' },
];

export function BottomBar({ active, onChange }: { active: TabKey; onChange: (t: TabKey) => void }) {
  return (
    <View style={styles.bar}>
      {TABS.map((t) => {
        const isActive = t.key === active;
        return (
          <Pressable
            key={t.key}
            accessibilityLabel={t.label}
            onPress={() => onChange(t.key)}
            style={({ pressed }) => [styles.tab, isActive && styles.tabActive, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name={t.icon} size={24} color={isActive ? colors.onAccent : colors.text} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: {
    width: 56,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: colors.accent,
    width: 72,
  },
});
