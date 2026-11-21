// Paleta do Bill.ia, tirada da logo: preto, azul elétrico e ciano.
// Para trocar o visual do app inteiro, basta mudar os valores aqui.
const palette = {
  black: '#03060F', // fundo quase preto, levemente azulado
  navy: '#0B1633', // azul-marinho dos cards
  navyLight: '#13224A',
  royal: '#1D4ED8', // azul forte das bordas
  electric: '#0F5BFF', // azul elétrico da logo
  sky: '#1E9BFF', // azul-céu do sino e das barras
  cyan: '#22D3EE', // brilho ciano da logo
};

export const colors = {
  bg: palette.black, // fundo principal
  surface: palette.navy, // cards, caixa de mensagem, barra inferior, botões do topo
  surfacePressed: palette.navyLight, // card pressionado
  border: palette.royal, // bordas e divisórias
  accent: palette.sky, // destaques ativos: aba selecionada, badge, chip de chamada
  accentSoft: palette.electric, // ícones secundários
  glow: palette.cyan, // brilho da logo
  text: '#FFFFFF',
  muted: '#A9C4F0',
  onAccent: '#020A1C', // texto/ícone em cima do destaque
};

export const radius = {
  card: 20,
  pill: 9999,
};
