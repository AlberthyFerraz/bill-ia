import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { requestCalendarAccess } from '../calendar';
import { getSetting, setSetting } from '../db';
import { exactAlarmsAllowed, requestExactAlarms } from '../notifications';
import { colors, radius } from '../theme';

export function ProfileScreen({ name, onNameChange }: { name: string; onNameChange: (n: string) => void }) {
  const [draft, setDraft] = useState(name);
  const [saveToCalendar, setSaveToCalendar] = useState(false);
  const [exactAlarms, setExactAlarms] = useState<boolean | null>(null);

  useEffect(() => {
    getSetting('save_to_calendar').then((v) => setSaveToCalendar(v === '1'));
    exactAlarmsAllowed().then(setExactAlarms);
  }, []);

  async function allowExactAlarms() {
    await requestExactAlarms();
    setExactAlarms(await exactAlarmsAllowed());
  }

  async function toggleCalendar(value: boolean) {
    if (value && !(await requestCalendarAccess())) return;
    setSaveToCalendar(value);
    await setSetting('save_to_calendar', value ? '1' : '0');
  }

  return (
    <View style={{ flex: 1, paddingHorizontal: 16 }}>
      <Text style={styles.title}>Perfil</Text>

      <Text style={styles.label}>Como o Bill deve te chamar?</Text>
      <TextInput
        style={styles.input}
        value={draft}
        onChangeText={setDraft}
        onEndEditing={() => onNameChange(draft.trim())}
        placeholder="Seu nome"
        placeholderTextColor={colors.muted}
      />

      <View style={styles.card}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Salvar no calendário do celular</Text>
          <Text style={styles.cardSub}>Cada lembrete com horário também vira um evento no calendário do aparelho.</Text>
        </View>
        <Switch
          value={saveToCalendar}
          onValueChange={toggleCalendar}
          trackColor={{ false: colors.bg, true: colors.accent }}
          thumbColor={colors.text}
        />
      </View>

      <View style={styles.card}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Tocar no horário exato</Text>
          <Text style={styles.cardSub}>
            {exactAlarms
              ? 'Liberado. O Bill toca no minuto certo.'
              : 'Desligado. O Android pode atrasar os lembretes alguns minutos.'}
          </Text>
        </View>
        {exactAlarms === false && (
          <Pressable onPress={allowExactAlarms} style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }]}>
            <Text style={styles.buttonText}>Liberar</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.footer}>Seus dados ficam só neste celular. O Bill.ia não usa conta nem servidor.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 22, fontWeight: '700', paddingTop: 12, paddingBottom: 16 },
  label: { color: colors.muted, fontSize: 14, marginBottom: 8 },
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: radius.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 16,
    marginTop: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  cardSub: { color: colors.muted, fontSize: 13, marginTop: 4, lineHeight: 18 },
  button: { backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 8 },
  buttonText: { color: colors.onAccent, fontWeight: '700', fontSize: 14 },
  footer: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 32 },
});
