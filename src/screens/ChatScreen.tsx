import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { handleMessage } from '../actions';
import { colors, radius } from '../theme';

interface Message {
  id: number;
  from: 'user' | 'bill';
  text: string;
}

interface Props {
  name: string;
  pendingToday: number;
  onOpenReminders: () => void;
  onOpenAgenda: () => void;
  onItemsChanged: () => void;
}

const EXAMPLES = [
  'Me lembra de tomar água daqui 10 minutos',
  'Me liga amanhã às 7 para acordar',
  'Reunião sexta às 15h',
];

export function ChatScreen({ name, pendingToday, onOpenReminders, onOpenAgenda, onItemsChanged }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [callMode, setCallMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const nextId = useRef(1);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  async function send(raw?: string) {
    const content = (raw ?? text).trim();
    if (!content || busy) return;
    setText('');
    setBusy(true);
    setMessages((m) => [...m, { id: nextId.current++, from: 'user', text: content }]);
    try {
      const reply = await handleMessage(content, callMode);
      setMessages((m) => [...m, { id: nextId.current++, from: 'bill', text: reply }]);
      onItemsChanged();
    } catch {
      setMessages((m) => [
        ...m,
        { id: nextId.current++, from: 'bill', text: 'Não consegui salvar isso agora. Tente de novo.' },
      ]);
    } finally {
      setBusy(false);
      setCallMode(false);
    }
  }

  const greeting = name ? `Oi, ${name}! O que eu anoto para você?` : 'Oi! O que eu anoto para você?';

  return (
    // "padding" também no Android: com o modo edge-to-edge o Android não redimensiona a tela sozinho.
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      {/* Cabeçalho */}
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Limpar conversa"
          style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
          onPress={() => setMessages([])}
        >
          <Ionicons name="create-outline" size={22} color={colors.text} />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Bill.ia</Text>
          <Text style={styles.headerSub}>seu assistente de lembretes</Text>
        </View>
        <Pressable
          accessibilityLabel="Lembretes de hoje"
          style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
          onPress={onOpenReminders}
        >
          <Ionicons name="notifications-outline" size={22} color={colors.text} />
          {pendingToday > 0 && <View style={styles.badge} />}
        </Pressable>
      </View>

      {/* Conversa ou tela inicial */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={messages.length === 0 ? styles.emptyContainer : styles.messages}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 ? (
          <>
            <Text style={styles.greeting}>{greeting}</Text>
            <View style={styles.card}>
              <QuickAction icon="alarm-outline" label="Criar um lembrete" onPress={() => setText('Me lembra de ')} />
              <View style={styles.divider} />
              <QuickAction icon="today-outline" label="O que tenho hoje?" onPress={() => send('O que tenho hoje?')} />
              <View style={styles.divider} />
              <QuickAction icon="calendar-outline" label="Abrir minha agenda" onPress={onOpenAgenda} />
            </View>
            <Text style={styles.examplesTitle}>Experimente dizer:</Text>
            {EXAMPLES.map((ex) => (
              <Pressable key={ex} onPress={() => send(ex)} style={({ pressed }) => [styles.example, pressed && styles.pressed]}>
                <Text style={styles.exampleText}>“{ex}”</Text>
              </Pressable>
            ))}
          </>
        ) : (
          messages.map((m) => (
            <View key={m.id} style={[styles.bubble, m.from === 'user' ? styles.userBubble : styles.billBubble]}>
              <Text style={m.from === 'user' ? styles.userText : styles.billText}>{m.text}</Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* Caixa de mensagem */}
      <View style={styles.inputCard}>
        <TextInput
          style={styles.input}
          placeholder="Escreva para o Bill…"
          placeholderTextColor={colors.muted}
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => send()}
          returnKeyType="send"
          multiline
        />
        <View style={styles.inputRow}>
          <Pressable
            onPress={() => setCallMode((v) => !v)}
            style={({ pressed }) => [styles.callChip, callMode && styles.callChipOn, pressed && styles.pressed]}
          >
            <Ionicons name="call" size={14} color={callMode ? colors.onAccent : colors.text} />
            <Text style={[styles.callChipText, callMode && { color: colors.onAccent }]}>Tocar como chamada</Text>
          </Pressable>
          {text.trim() ? (
            <Pressable
              accessibilityLabel="Enviar"
              onPress={() => send()}
              style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
            >
              <Ionicons name="arrow-up" size={22} color={colors.text} />
            </Pressable>
          ) : (
            <Pressable
              accessibilityLabel="Falar"
              onPress={() =>
                Alert.alert(
                  'Falar com o Bill',
                  'Por enquanto, toque no microfone do teclado do celular para ditar a mensagem.',
                )
              }
              style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
            >
              <Ionicons name="mic" size={22} color={colors.text} />
            </Pressable>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function QuickAction({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quick, pressed && { backgroundColor: colors.surfacePressed }]}>
      <Ionicons name={icon} size={22} color={colors.text} />
      <Text style={styles.quickText}>{label}</Text>
      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  roundButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  badge: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  headerTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  headerSub: { color: colors.muted, fontSize: 12, marginTop: 2, opacity: 0.85 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 24 },
  messages: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  greeting: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 30,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  quick: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 16, gap: 14 },
  quickText: { flex: 1, color: colors.text, fontSize: 16 },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 18 },
  examplesTitle: { color: colors.muted, fontSize: 13, marginTop: 24, marginBottom: 8, textAlign: 'center' },
  example: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 8,
    alignSelf: 'center',
  },
  exampleText: { color: colors.muted, fontSize: 14 },
  bubble: { maxWidth: '85%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: colors.accent, borderBottomRightRadius: 4 },
  billBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userText: { color: colors.onAccent, fontSize: 15 },
  billText: { color: colors.text, fontSize: 15, lineHeight: 21 },
  inputCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: { color: colors.text, fontSize: 16, maxHeight: 110, paddingVertical: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  callChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  callChipOn: { backgroundColor: colors.accent },
  callChipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  actionButton: {
    width: 56,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
