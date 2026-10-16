---
name: ScoreLab
description: Bancada de apostas em papel claro — números grandes, laranja só onde se decide, cor como código de estado.
colors:
  primary: "hsl(14 100% 50%)"
  primary-glow: "hsl(22 100% 54%)"
  cool: "hsl(214 88% 46%)"
  green: "hsl(152 72% 30%)"
  green-cta: "hsl(152 64% 38%)"
  warning: "hsl(32 95% 44%)"
  destructive: "hsl(347 77% 50%)"
  ink: "hsl(216 44% 11%)"
  ink-muted: "hsl(219 24% 38%)"
  paper: "hsl(30 30% 97%)"
  card: "hsl(0 0% 100%)"
  surface: "hsl(28 40% 97.5%)"
  border: "hsl(219 30% 91%)"
  nav: "hsl(222 40% 9%)"
  chart-good: "#047857"
  chart-bad: "#e11d48"
  chart-none: "#7c8698"
typography:
  display:
    fontFamily: "Archivo Variable, Schibsted Grotesk Variable, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 7vw, 2.75rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.03em"
    fontVariation: "'wdth' 112"
    fontFeature: "tabular-nums"
  headline:
    fontFamily: "Archivo Variable, Schibsted Grotesk Variable, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.018em"
    fontVariation: "'wdth' 106"
  title:
    fontFamily: "Archivo Variable, Schibsted Grotesk Variable, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Schibsted Grotesk Variable, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "-0.005em"
  label:
    fontFamily: "Schibsted Grotesk Variable, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.13em"
  data:
    fontFamily: "Archivo Variable, Schibsted Grotesk Variable, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
    fontFeature: "tabular-nums"
rounded:
  pill: "999px"
  cta: "10px"
  control: "14px"
  card: "20px"
  raised: "22px"
spacing:
  hairline: "2px"
  tight: "6px"
  snug: "10px"
  base: "16px"
  loose: "24px"
  section: "32px"
components:
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "16px"
  card-raised:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.raised}"
    padding: "16px"
  section-panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.raised}"
    padding: "10px"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.card}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
  button-cta:
    backgroundColor: "{colors.green-cta}"
    textColor: "{colors.card}"
    rounded: "{rounded.cta}"
    padding: "12px 20px"
  chip:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "8px 14px"
  chip-active:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.card}"
    rounded: "{rounded.pill}"
    padding: "8px 14px"
  pill-win:
    backgroundColor: "{colors.green}"
    textColor: "{colors.green}"
    rounded: "{rounded.pill}"
    padding: "4px 11px"
  pill-loss:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.destructive}"
    rounded: "{rounded.pill}"
    padding: "4px 11px"
  pill-open:
    backgroundColor: "{colors.warning}"
    textColor: "{colors.warning}"
    rounded: "{rounded.pill}"
    padding: "4px 11px"
  topbar:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.card}"
    height: "56px"
  bottomnav:
    backgroundColor: "{colors.nav}"
    textColor: "{colors.card}"
    rounded: "{rounded.pill}"
    padding: "6px"
---

# Design System: ScoreLab

## Overview

**Creative North Star: "A Bancada"**

A ScoreLab vê-se de pé, com o jogo a começar, numa mão só. Por isso não é uma
folha de cálculo: é a bancada. O número é o que se grita — grande, alinhado,
legível de braço esticado — e tudo o resto existe para o deixar respirar. O
laranja da marca é a camisola da casa: aparece onde se decide alguma coisa e em
mais lado nenhum, porque se estiver em todo o lado deixa de querer dizer
qualquer coisa.

O chão é papel claro e quente (`paper`), não branco e não cinzento, com duas
auras muito fracas por baixo de tudo: laranja no topo, azul-escuro no canto de
baixo. Em cima dele pousam cartões brancos com três sombras cada — linha de
contacto, sombra direta, sombra ambiente — que é o que faz um retângulo parecer
pousado em vez de pintado. A energia vem do contraste entre esse fundo calmo e
os números, não de gradientes espalhados pela página.

A cor trabalha como código de estado, nunca como decoração: cada secção tem um
painel com o seu tom por baixo, e é esse tom que diz de que tipo de coisa se
trata antes de se ler uma palavra. Laranja para o que há para escolher, azul
frio para material de consulta, âmbar para o que está à tua espera, verde para o
que já ficou fechado. **Anti-referência confirmada:** o HUD escuro de néon ciano
que a aplicação já foi (`scorelab-aurora`, `scorelab-premium-shell`) — fundo
preto, vidro e brilho — não volta.

O papel não é liso nem está parado: tem grão (um ruído a 4%, fixo, por trás de
tudo) e uma luz que atravessa a página muito devagar — 34 segundos de um lado
ao outro, parada para quem pediu menos movimento ao sistema. É o que separa um
fundo pintado de uma superfície.

**Key Characteristics:**
- Papel quente com grão em baixo, cartões brancos pousados em cima, nunca o
  contrário.
- O número é o herói: `Archivo` de largura variável, tabular, apertado — e a
  largura é o eixo que a aplicação anima quando o saldo mexe.
- Laranja só onde se decide; o resto do sinal vem do tom da secção.
- Um gradiente em toda a aplicação, e só num botão e na barra de topo.
- Tudo em que um polegar toca cede debaixo dele; o que entra, entra com mola.

## Colors

Uma paleta de papel quente com uma camisola laranja, três cores de estado e um
azul frio que separa "para consultar" de "para decidir".

### Primary
- **Laranja de Bancada** (`hsl(14 100% 50%)`): a cor da marca. Aparece no botão
  que compromete dinheiro, na barra de topo, no separador ativo e no item ativo
  da navegação. Em mais lado nenhum.
- **Laranja de Luz** (`hsl(22 100% 54%)`): só como segundo ponto do gradiente e
  no ícone ativo da barra de baixo, onde o laranja cheio não teria contraste
  contra o azul-noite.

### Secondary
- **Azul de Consulta** (`hsl(214 88% 46%)`): o frio da casa, e a cor de medir.
  Marca as secções de material — o quadro de jogos, as leituras — e enche
  qualquer barra que seja uma medida sem veredicto: a banca por desafio, o
  avanço de um desafio pelos dias, as barras das Análises que não comparam com
  nada.

### Tertiary
- **Verde de Fechado** (`hsl(152 72% 30%)`): escuro o suficiente para se ler
  sobre branco. É o verde dos números: probabilidades, ganhos, o que correu bem.
- **Verde de Confirmar** (`hsl(152 64% 38%)`): mais saturado, existe só para
  viver por baixo de texto branco num botão cheio.
- **Âmbar de Espera** (`hsl(32 95% 44%)`): o que está por fechar, o que depende
  de ti.
- **Carmim de Perdido** (`hsl(347 77% 50%)`): apostas perdidas e erros.

### Neutral
- **Papel** (`hsl(30 30% 97%)`): o fundo de tudo. Quente de propósito.
- **Cartão** (`hsl(0 0% 100%)`): branco puro, reservado às superfícies que
  pousam no papel.
- **Superfície Interior** (`hsl(28 40% 97.5%)`): o enchimento dentro de um
  cartão. É branco tingido e não cinzento, porque cinzento lia-se como painel
  desligado.
- **Tinta** (`hsl(216 44% 11%)`): todo o texto que conta.
- **Tinta Apagada** (`hsl(219 24% 38%)`): legendas, metadados, unidades.
- **Linha** (`hsl(219 30% 91%)`): divisórias e contornos de chips.
- **Azul-Noite** (`hsl(222 40% 9%)`): a pílula da navegação de baixo, a única
  superfície escura que resta.

### Named Rules

**A Regra da Camisola.** O laranja da marca só toca em elementos que mudam
alguma coisa: o botão que fecha uma aposta, a barra de topo, o estado ativo. Se
um ecrã tiver mais de três coisas laranja, duas estão a mentir.

**A Regra do Tom da Secção.** Uma secção diz o que é pela cor do painel, não
pelo título: laranja (há aqui o que escolher), azul (é para consultar), âmbar
(está à tua espera), verde (já está fechado). Nenhuma secção fica sem tom por
preguiça.

**A Regra das Barras.** Uma barra preenchida nunca é laranja. Verde quando bate
o que era preciso, carmim quando não bate, cinzento quando há jogos a menos
para dizer, azul quando é só uma medida. O laranja é para quem decide, e uma
barra não decide nada.

**A Regra dos Dois Verdes.** O verde escuro é para números sobre branco; o verde
saturado é para texto branco sobre cheio. Trocá-los parte o contraste nos dois
sentidos.

**A Regra do Daltónico.** Verde contra vermelho nunca passa sozinho o teste de
daltonismo. Qualquer gráfico que os use carrega também o número impresso e uma
textura — a separação não pode assentar no tom.

## Typography

**Display Font:** Archivo Variable (com Schibsted Grotesk, system-ui, sans-serif)
**Body Font:** Schibsted Grotesk Variable (com system-ui, sans-serif)
**Label/Data Font:** Archivo Variable em largura 100, com `tabular-nums`

**Character:** Um par de contraste de largura. O `Archivo` é
condensado-expansível, e a largura variável é usada como peso visual — 112 no
número que manda, 106 nos títulos, 100 nos dados em coluna. Contra essas
figuras largas fica o `Schibsted Grotesk` na prosa: um grotesco de jornal, de
aberturas largas e desenho próprio, com um apertar quase impercetível
(`-0.005em`) para o texto não boiar. O corpo foi `Instrument Sans` e saiu por
não ter nada de seu — é a letra por omissão de metade das interfaces novas.
A troca custa 4% de largura ao texto, medido antes de se fazer. Não há
monoespaçado: o que o monoespaçado fazia de útil era alinhar euros em coluna, e
isso faz-se com `tabular-nums` sem fazer a página parecer uma impressão de
caixa.

### Hierarchy
- **Display** (700, `clamp(1.75rem, 7vw, 2.75rem)`, altura 1, `wdth` 112): a
  banca, a odd do boletim, o nível. Um por ecrã, no máximo dois.
- **Headline** (700, ~1.25rem, `wdth` 106, `-0.018em`, `text-wrap: balance`):
  todos os `h1`–`h6`. O equilíbrio de linhas é automático, não manual.
- **Title** (800, 13.5px): o cabeçalho de uma secção, com a marca de cor ao
  lado.
- **Body** (400, 15px, 1.45): prosa, nomes de equipas, explicações.
- **Label** (700, 10px, `0.13em`, maiúsculas): a sobrancelha por cima do título
  de secção. Curta sempre — duas ou três palavras.
- **Data** (600, `tabular-nums`, `-0.02em`): percentagens, euros, odds em
  qualquer sítio onde apareçam em coluna.

### Named Rules

**A Regra do Número Gritado.** Em cada ecrã há exatamente um número que se lê de
longe. Se houver dois a competir, um deles não é o assunto do ecrã.

**A Regra da Coluna Direita.** Qualquer número que apareça por baixo de outro
número leva `tabular-nums`. Uma coluna de euros desalinhada é um erro, não uma
escolha.

## Layout

Uma coluna. A aplicação é de telemóvel e o layout assume-o: conteúdo numa
coluna centrada com margens laterais de 16px, barra de topo laranja fixa, e uma
pílula de navegação a flutuar sobre o fundo da página (a faixa onde ela assenta
fica transparente, para o conteúdo passar por baixo).

O ritmo é de três degraus: 10px dentro de um painel de secção, 16px entre
cartões, 24–32px entre secções. Os cartões não encostam às margens nem se
colam uns aos outros; o papel entre eles é o que os separa, não linhas.

Em ecrãs largos a coluna cresce até um máximo legível e centra-se — não há
layout de duas colunas desenhado, e inventar um num ecrã solto parte a
consistência com o telemóvel.

## Elevation & Depth

O sistema é **levantado, não plano e não de vidro**. A profundidade é feita de
sombras compostas em três partes, sempre as três juntas: uma linha de contacto
de 1px, uma sombra direta curta e uma sombra ambiente larga e difusa. Por cima,
cada cartão leva um realce interior branco no topo (`inset 0 1px 0`) e um anel
de 1px a 5–6% de tinta — é esse par que faz a luz vir de cima em vez de o cartão
parecer recortado.

Há dois degraus e só dois: o cartão normal e o cartão levantado, reservado ao
bloco que manda em cada página.

### Shadow Vocabulary
- **Cartão** (`0 1px 2px / 0 6px 14px -6px / 0 18px 40px -16px` em tinta a
  5–12%): o estado de repouso de qualquer superfície branca.
- **Cartão sob o dedo** (`0 1px 2px / 0 10px 22px -8px / 0 28px 56px -22px`):
  resposta ao rato, acompanhada de `translateY(-2px)`.
- **Levantado** (`0 1px 2px / 0 12px 24px -10px / 0 36px 64px -28px`): o bloco
  principal da página — a banca, o nível, o boletim a fechar.
- **Brilho da marca** (`0 6px 18px -6px` em laranja a 42%): só por baixo do
  botão laranja.

### Movimento

Um sistema só, em `src/lib/motion.ts`, importado por todas as páginas: o
conteúdo entra de baixo com mola (`stiffness` 280, `damping` 28), sai de um
desfoque de 3px, e os filhos de uma página entram em fila a 55ms de intervalo.
Nada disto usa durações fixas — uma mola acaba quando o peso manda, e é isso
que o olho lê como físico. O `<MotionConfig reducedMotion="user">` na raiz
desliga tudo para quem pediu menos movimento, sem cada componente ter de se
lembrar.

Há exactamente três momentos autorais, e cada um aparece num sítio só: o
reflexo que atravessa o botão laranja, a marca da navegação que escorrega de
um destino para o outro, e a largura da figura que abre e fecha quando o saldo
muda.

### Named Rules

**A Regra do Degrau Único.** Numa página há um elemento levantado. Se dois se
levantam, nenhum se levanta.

**A Regra das Três Sombras.** Uma sombra sozinha não se usa. Contacto, direta e
ambiente andam sempre juntas — é a ausência da linha de contacto que faz um
cartão parecer colado ao fundo.

## Shapes

Cantos generosos e consistentes, numa escala curta: 999px nas pílulas e chips,
10px no botão de confirmar, 14px no botão laranja e nos controlos, 20px nos
cartões, 22px nos painéis de secção e nos cartões levantados. Nada tem cantos
vivos.

Os contornos quase nunca são bordas a sério: são anéis interiores
(`inset 0 0 0 1px`) a 5–6% de tinta, ou a 18–30% da cor do tom quando a secção
é colorida. Uma borda opaca cinzenta só aparece nos chips e nas divisórias.

## Components

### Buttons
- **Shape:** cantos macios (14px no laranja, 10px no verde de confirmar).
- **Primary (laranja):** o único gradiente da aplicação
  (`135deg`, `hsl(18 100% 54%)` → `hsl(8 92% 48%)`), texto branco a 700, realce
  interior no topo e um brilho laranja por baixo. É o botão que compromete.
- **CTA (verde):** `green-cta` cheio com texto branco. Confirmar, aceitar,
  guardar — ações que não gastam dinheiro.
- **Hover / Focus:** o laranja clareia 6% e a sombra abre; o verde clareia 8%. O
  foco de teclado é um contorno laranja de 2px a 70%, com 2px de folga, global.
- **Active:** `scale(0.985)`.
- **Ghost / Secondary:** sem fundo, texto em tinta apagada; usados só para ações
  de saída (cancelar, fechar).

### Chips
- **Style:** pílula branca com borda de 1px na cor da linha, texto a 600, 13px,
  nunca quebra linha.
- **State:** ativo = laranja cheio com texto branco. Hover (só com rato) escurece
  a borda. Servem para filtrar: liga, dia, mercado.

### Pills (estado)
- **Style:** pílula **sem borda**, fundo a 12–15% da cor do estado e texto na
  cor cheia. Ganha (verde), perdida (carmim), por fechar (âmbar), neutra
  (cinzento).
- **Porquê sem preenchimento sólido:** um boletim com oito pernas teria oito
  blocos de cor a gritar ao mesmo tempo.

### Cards / Containers
- **Corner Style:** 20px (cartão), 22px (levantado e painel de secção).
- **Background:** branco com um brilho em gradiente nos 42% de cima, que é o que
  simula a luz a cair.
- **Shadow Strategy:** ver Elevation; o cartão interativo troca para a sombra de
  hover e sobe 2px.
- **Border:** anel interior a 5,5% de tinta — nunca uma borda cinzenta.
- **Internal Padding:** 16px (cartão), 10px (painel de secção, que é só a
  moldura de cor à volta dos cartões lá dentro).

### Section Panel
O componente que organiza todas as páginas: um painel com o tom da secção, um
cabeçalho com marca de cor + sobrancelha + título + contagem + nota, e os
cartões por dentro. É aqui que vive a Regra do Tom da Secção.

### Inputs / Fields
- **Style:** fundo de superfície interior, anel de 1px, cantos de controlo.
- **Focus:** anel laranja; o `:focus-visible` global cobre tudo o que não tenha
  tratamento próprio.
- **Error:** texto e anel em carmim, com a mensagem por baixo do campo.

### Navigation
- **Topo:** barra laranja com o gradiente da marca, um brilho quente no canto
  superior direito, realce interior em cima e um fio escuro em baixo a separá-la
  do papel.
- **Baixo:** pílula azul-noite a flutuar, com sombra própria; o item ativo leva
  fundo laranja a 18% e ícone em laranja claro. A faixa onde a pílula assenta é
  transparente.

### Outcome Row (componente de assinatura)
A linha 1 / X / 2: rótulo à esquerda, número à direita em verde, a linha inteira
é uma zona de toque. É o átomo do quadro de jogos e a razão de existir a família
`tabular-nums`.

## Do's and Don'ts

### Do:
- **Do** usar `sl-card` ou `sl-raised` para qualquer superfície branca, e
  `sl-sec` com um `data-tone` para qualquer agrupamento de cartões.
- **Do** pôr `tabular-nums` (via `.sl-figure`, `.font-mono-data` ou o papel
  `data`) em todos os números que possam aparecer uns por baixo dos outros.
- **Do** dar `.sl-tap` a tudo o que um polegar toca, para ceder debaixo do dedo.
- **Do** manter as áreas de toque com pelo menos 44×44px.
- **Do** respeitar `prefers-reduced-motion` em qualquer animação nova — a
  aplicação já o faz nas que tem.
- **Do** escrever números medidos; um valor de exemplo numa interface é uma
  mentira à espera de ser lida como verdade.

### Don't:
- **Don't** reintroduzir o mundo escuro de néon: `scorelab-aurora`,
  `scorelab-premium-shell`, `glass-surface`, `--scorelab-*`. É a anti-referência
  do projeto.
- **Don't** inventar um terceiro degrau de elevação nem uma quarta sombra.
- **Don't** usar o gradiente laranja em superfícies — ele existe para o botão
  principal e para a barra de topo, mais nada.
- **Don't** pintar bordas cinzentas opacas à volta de cartões; o anel interior a
  5,5% é o contorno da casa.
- **Don't** usar cinzento (`muted`) como fundo de um enchimento dentro de um
  cartão; é para isso que existe a superfície interior tingida.
- **Don't** pôr dois números de display a competir no mesmo ecrã.
