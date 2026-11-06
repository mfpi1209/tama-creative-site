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
