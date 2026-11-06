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
