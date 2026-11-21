import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

// Tempo mínimo na tela, para a abertura não piscar quando o app carrega rápido.
const MIN_VISIBLE_MS = 2200;

interface Props {
  // true quando o app terminou de carregar os dados.
  ready: boolean;
  // Chamado depois da animação de saída.
  onFinish: () => void;
  // Chamado quando a tela aparece (para esconder a abertura nativa do Android).
  onShown?: () => void;
}

const LOGO = 260;
const BELL = 58;
const BAR_HEIGHTS = [22, 36, 50, 64];

export function LoadingScreen({ ready, onFinish, onShown }: Props) {
  const [enter] = useState(() => new Animated.Value(0));
  const [exit] = useState(() => new Animated.Value(1));
  const [swing] = useState(() => new Animated.Value(0));
  const [waves] = useState(() => [new Animated.Value(0), new Animated.Value(0)]);
  const [bars] = useState(() => BAR_HEIGHTS.map(() => new Animated.Value(0)));
  const [dots] = useState(() => [0, 1, 2].map(() => new Animated.Value(0)));
  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    // Entrada do quadro.
    Animated.timing(enter, {
      toValue: 1,
      duration: 650,
      easing: Easing.out(Easing.back(1.3)),
      useNativeDriver: true,
    }).start();

    // Barras crescendo uma a uma (altura não roda no driver nativo).
    Animated.stagger(
      120,
      bars.map((b) =>
        Animated.timing(b, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      ),
    ).start();

    // Sino balançando: vai e volta, com uma pausa curta, como um sino tocando.
    const swingLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(swing, { toValue: 1, duration: 140, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(swing, { toValue: -1, duration: 260, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(swing, { toValue: 0.6, duration: 220, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(swing, { toValue: -0.4, duration: 200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(swing, { toValue: 0, duration: 180, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.delay(350),
      ]),
    );

    // Ondas de som acendendo de dentro para fora.
    const wavesLoop = Animated.loop(
      Animated.stagger(
        180,
        waves.map((w) =>
          Animated.sequence([
            Animated.timing(w, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.timing(w, { toValue: 0, duration: 500, useNativeDriver: true }),
          ]),
        ),
      ),
    );

    const dotsLoop = Animated.loop(
      Animated.stagger(
        160,
        dots.map((d) =>
          Animated.sequence([
            Animated.timing(d, { toValue: 1, duration: 280, useNativeDriver: true }),
            Animated.timing(d, { toValue: 0, duration: 280, useNativeDriver: true }),
          ]),
        ),
      ),
    );

    swingLoop.start();
    wavesLoop.start();
    dotsLoop.start();

    const timer = setTimeout(() => setMinElapsed(true), MIN_VISIBLE_MS);
    return () => {
      clearTimeout(timer);
      swingLoop.stop();
      wavesLoop.stop();
      dotsLoop.stop();
    };
  }, [enter, swing, waves, bars, dots]);

  // Saída: quando os dados carregaram e o tempo mínimo passou.
  useEffect(() => {
    if (!ready || !minElapsed) return;
    Animated.timing(exit, { toValue: 0, duration: 380, useNativeDriver: true }).start(({ finished }) => {
      if (finished) onFinish();
    });
  }, [ready, minElapsed, exit, onFinish]);

  const logoScale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });
  const rotate = swing.interpolate({ inputRange: [-1, 1], outputRange: ['-22deg', '22deg'] });

  return (
    <Animated.View style={[styles.container, { opacity: exit }]} onLayout={onShown}>
      <Animated.View style={[styles.glowOuter, { opacity: enter, transform: [{ scale: logoScale }] }]}>
        <View style={styles.logo}>
          {/* Faixa azul diagonal no canto superior esquerdo */}
          <View style={styles.sweep} />

          {/* Sino com ondas */}
          <View style={styles.bellArea}>
            <Wave value={waves[1]} size={78} side="left" />
            <Wave value={waves[0]} size={54} side="left" />
            {/* Gira em torno do topo: desce o eixo, gira, sobe de volta */}
            <Animated.View
              style={{
                transform: [{ translateY: -BELL / 2 }, { rotate }, { translateY: BELL / 2 }],
              }}
            >
              <Ionicons name="notifications" size={BELL} color={colors.accent} />
            </Animated.View>
            <Wave value={waves[0]} size={54} side="right" />
            <Wave value={waves[1]} size={78} side="right" />
          </View>

          {/* Nome */}
          <Text style={styles.name} accessibilityRole="header">
            Bill.<Text style={styles.nameAccent}>IA</Text>
          </Text>

          {/* Faixa ciano e barras subindo */}
          <View style={styles.swoosh} />
          <View style={styles.bars}>
            {bars.map((b, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.bar,
                  { height: b.interpolate({ inputRange: [0, 1], outputRange: [0, BAR_HEIGHTS[i]] }) },
                ]}
              />
            ))}
          </View>
        </View>
      </Animated.View>

      <Animated.Text style={[styles.subtitle, { opacity: enter }]}>seu assistente de lembretes</Animated.Text>

      <View style={styles.dots} accessibilityLabel="Carregando">
        {dots.map((d, i) => (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              {
                opacity: d.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
                transform: [{ translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }],
              },
            ]}
          />
        ))}
      </View>
    </Animated.View>
  );
}

// Arco de onda sonora: um círculo com só a borda de um lado visível.
function Wave({ value, size, side }: { value: Animated.Value; size: number; side: 'left' | 'right' }) {
  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 4,
        borderColor: 'transparent',
        [side === 'left' ? 'borderLeftColor' : 'borderRightColor']: colors.glow,
        left: side === 'left' ? (BELL_AREA - size) / 2 - size * 0.42 : undefined,
        right: side === 'right' ? (BELL_AREA - size) / 2 - size * 0.42 : undefined,
        top: (BELL_AREA_H - size) / 2,
        opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
      }}
    />
  );
}

const BELL_AREA = 200;
const BELL_AREA_H = 96;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  // Contorno externo ciano, simulando o brilho da logo.
  glowOuter: {
    borderRadius: 60,
    borderWidth: 2,
    borderColor: colors.glow,
    padding: 4,
    shadowColor: colors.glow,
    shadowOpacity: 0.9,
    shadowRadius: 24,
    elevation: 18,
  },
  logo: {
    width: LOGO,
    height: LOGO,
    borderRadius: 54,
    borderWidth: 4,
    borderColor: colors.accentSoft,
    backgroundColor: colors.bg,
    overflow: 'hidden',
    alignItems: 'center',
    paddingTop: 22,
  },
  sweep: {
    position: 'absolute',
    width: 320,
    height: 120,
    top: -70,
    left: -150,
    backgroundColor: colors.accentSoft,
    opacity: 0.45,
    transform: [{ rotate: '-40deg' }],
  },
  bellArea: {
    width: BELL_AREA,
    height: BELL_AREA_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    color: colors.text,
    fontSize: 54,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: -1,
    marginTop: -6,
    textShadowColor: colors.glow,
    textShadowRadius: 14,
    textShadowOffset: { width: 0, height: 0 },
  },
  nameAccent: { color: colors.accent },
  swoosh: {
    position: 'absolute',
    width: 260,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.glow,
    bottom: 78,
    left: 10,
    transform: [{ rotate: '-11deg' }],
  },
  bars: {
    position: 'absolute',
    right: 26,
    bottom: 18,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  bar: { width: 24, backgroundColor: colors.accentSoft, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  subtitle: { color: colors.muted, fontSize: 15, marginTop: 28 },
  dots: { position: 'absolute', bottom: 72, flexDirection: 'row', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
});
