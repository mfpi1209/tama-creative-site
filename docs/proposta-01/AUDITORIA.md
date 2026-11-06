# Auditoria da /v2/ pelo HIG da Apple (06/11/2026)

O Human Interface Guidelines é escrito para apps nativos; aqui foram usados os fundamentos que valem para uma página
web: princípios de design, acessibilidade, tipografia, layout, cor, movimento, escrita e marca. Medição automática em
1440 px e 390 px (contraste de todo texto, área de toque, tamanho mínimo, títulos, texto alternativo, foco, texto a
200% e redução de movimento), mais revisão visual.

| Fundamento (HIG) | O que diz | Antes | Depois |
|---|---|---|---|
| Accessibility: contraste | 4,5:1 até 17 pt; 3:1 em texto grande ou negrito | "GUIA" em coral sobre claro: 3,6:1 | `#A9472F`: 5,5:1. Nenhum texto abaixo do mínimo |
| Accessibility: tamanho de controle | 44×44 por padrão | Filtros com 40 px (computador) e 34 px (celular) | 44 px nas duas larguras |
| Typography: legibilidade | Seguir tamanhos mínimos; evitar texto muito pequeno | Descrições do processo e notas com 12 px | 13–14 px; só a legenda "Imagem ilustrativa" fica com 12 px |
| Layout: largura do texto | Limitar a largura do texto para leitura | Subtítulos e respostas com até ~120 caracteres por linha | Até 64 caracteres |
| Accessibility: texto maior | Ampliar até 200% sem perder conteúdo | 3 cartões de "O que a TaMa faz" cortavam palavras | Palavras longas quebram; nada cortado |
| Layout: espaçamento consistente | Espaçamento constante facilita a leitura | Processo com respiro de ~104 px, demais seções 56–64 | 64 px (48 no celular) |
| Motion | Movimento com propósito e opcional | Só zoom suave em cards ao passar o mouse | Sem transições com Reduce Motion (conferido) |
| Color | Não depender só de cor | Filtro ativo muda cor e também `aria-pressed` | Mantido |
| Layout: hierarquia | Hierarquia clara | 1 H1, H2 por seção, H3 nos cartões | Mantido |

Também mudou nesta rodada: "Do briefing à entrega" volta à seção padrão do site, com os seis ícones no verde escuro
(`process_section`), no lugar da faixa compacta da referência.

Pontos para decisão do conteúdo (não alterados):
- O cartão de hotelaria usa o título "Hotelaria / Jogo americano" e o de eventos "Buffet Completo / Serviço Completo",
  como foram editados no admin (Páginas › Home); valem também na home atual.
- "Solicitar proposta" aparece duas vezes (hero e chamada final), com o mesmo destino: esperado.

## Segunda passada: skill apple-design (Emil Kowalski, github.com/emilkowalski/skills)

A skill traduz para a web as palestras de design da Apple (WWDC): resposta imediata, movimento interrompível,
consistência espacial, materiais, preferências de acessibilidade e tipografia. A /v2/ não tem gestos de arrastar,
folhas ou carrossel, então a parte de molas, velocidade e momento não se aplica; o resto foi conferido:

| Princípio da skill | Antes | Depois |
|---|---|---|
| Typography: respeitar o tamanho de texto do usuário (`rem`, não `px`) | 38 regras de texto em `px`: a fonte escolhida no navegador não mudava nada | Textos em `rem`; a 125%, 150% e 200% a página cresce sem corte nem rolagem lateral |
| Response: retorno no toque, não ao soltar | Cards e filtros só reagiam ao passar o mouse | `:active` com leve redução de escala (100 ms) em cards, filtros e botões; desligado com Reduce Motion |
| Response: atrasos no caminho do toque | Toque duplo podia atrasar o toque simples | `touch-action: manipulation` em links, botões e perguntas |
| Materials: borda suave, não divisor rígido | Cabeçalho com linha de 1 px | Sombra suave na borda do cabeçalho |
| Reduced transparency / more contrast | Cabeçalho translúcido sempre | Sólido com `prefers-reduced-transparency`; sólido com borda definida com `prefers-contrast: more` |
| Typography: espaçamento por tamanho | Títulos com espaçamento negativo, corpo em 0, rótulos em caixa alta positivos | Mantido (já seguia) |
| Animar só `transform` e `opacity` | Zoom da foto em `transform` | Mantido |

## Terceira passada: reauditoria com as skills instaladas (06/11/2026)

Quatro auditorias em paralelo, só leitura: **impeccable** (audit + critique: 13/20 técnica, 22/32 heurísticas),
**emil-design-eng** (acabamento e movimento), **design:accessibility-review** (WCAG 2.1 AA) e **motion** (desempenho:
nota A, CLS 0, LCP do hero ~200 ms no computador). Aplicado na /v2/:

| Achado (quem apontou) | Correção |
|---|---|
| Anel de foco invisível no verde, no bordô e no rodapé (todas) | Anel creme `#FCF9F5` nessas faixas; sem anel duplo na busca; sem anel em volta de `main` após o "Pular para o conteúdo" |
| Filtro sem aviso para leitor de tela e com salto seco (acessibilidade, impeccable, emil, motion) | `role="status"` com "N categorias: Kits"; View Transitions (cards deslizam) onde há suporte e sem movimento reduzido |
| Nome do link dos cards começava pela descrição da foto (acessibilidade, impeccable) | `aria-labelledby` no título; título vira `h3`; "Ver modelos", "Ler o guia" e "GUIA" ocultos para leitor de tela |
| Hover e "pressionar" dos botões brigando (emil, motion) | Pressionar usa `scale` (não `transform`); sem subida no hover na /v2/; mola curta na volta |
| Curvas e tempos diferentes de zoom (emil, motion) | Uma curva `cubic-bezier(.23,1,.32,1)` e zoom 1,03 em 350 ms nas três famílias de card, só com mouse |
| Sombra dos cartões aparecia de golpe (emil, motion) | `box-shadow` volta à transição |
| Pills sem contorno visível (acessibilidade); "Vestuário" sozinho na 2ª linha no celular (emil, impeccable) | Contorno `#948779` (3,3:1); pills mais estreitas no celular, os quatro numa linha; contorno extra no modo de alto contraste do Windows |
| Perguntas abriam sem transição; "+" no meio de perguntas de duas linhas (emil) | Altura animada (`::details-content`, onde há suporte); "+" na primeira linha; hover e foco com respiro |
| Blur do cabeçalho caro e quase invisível (motion) | Cabeçalho sólido |
| Fotos de "O que a TaMa faz" maiores que o necessário (motion) | `sizes` do tamanho real (também melhora a home atual, sem mudar o visual) |
| Hero apertado e foto borrada de 768 a 1023 px (impeccable) | Hero empilhado até 1023 px; `sizes` do hero de acordo com a área pintada |
| Dois blocos de cards seguidos sem separação; nomes do catálogo maiores que os títulos da seção (impeccable) | "O que a TaMa faz" em faixa areia; nomes dos dois grupos com o mesmo tamanho |
| "Ler o guia" desalinhado; pesos de título diferentes (impeccable) | Link no pé dos três cards; títulos de seção com peso 500 |
| Página longa no celular; WhatsApp flutuante cobrindo o rodapé (impeccable) | Fotos do catálogo 4:3 até 479 px e guias em linha até 767 px (de 9.108 para 8.210 px); rodapé com espaço para o botão |
| Movimento reduzido: hover ainda "pulava" (motion) | Sem zoom, seta ou escala com movimento reduzido |
| Bordô em dois tons (#521B2C e #501B2B) (impeccable) | Na /v2/, `--wine` usa o mesmo bordô da proposta |

Não aplicado (afeta o site todo ou depende de decisão):
- Menus do cabeçalho abertos por hover: Esc não fecha e `aria-expanded` não acompanha; o toque no ☰ do celular abre o
  teclado (foco vai para a busca); regra global de movimento reduzido corta também fades de cor. São do site inteiro.
- Alvos abaixo de 44 px fora da /v2/: botão "Solicitar proposta" do cabeçalho (42 px), links do rodapé (~33 px),
  ícones sociais (40 px). Critério AAA; do site inteiro.
- Segundo botão no hero ("Ver presentes de fim de ano"), sugerido pelo impeccable: o mockup tem um botão só.
- O filtro "Kits" e "Vestuário" levam às mesmas páginas dos cartões de "O que a TaMa faz" (o controle de 4 filtros
  e 6 cards é do pacote aprovado).
