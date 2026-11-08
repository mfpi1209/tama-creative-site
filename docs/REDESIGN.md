# Redesenho visual e de navegação (11/2026)

Branch `redesign/visual-motion` (a partir de `origin/main` 3b4ad24). Direção aprovada: branco, cinza frio e preto como
base, bordô pontual, cores vindas dos próprios produtos; Manrope nos títulos, DM Sans no texto. Em 08/11/2026 o cliente
pediu mais calor (via cor dos produtos, sem creme/bege) e a assinatura "TaMa." em Manrope, como na prévia aprovada.

## Diagnóstico (auditoria)

- **Stack**: gerador estático em Python (`build.py`, `blog.py`) → `dist/`; Nginx no Easypanel (imagem montada no
  GitHub Actions); formulário em `/api/proposta` → n8n; inventário do cliente em `/admin/inventario/` (edita
  `src/data/*.json`). Mantida: nenhuma mudança estrutural foi necessária.
- **Dados**: `produtos.json` (banco de fotos por cor), `modelos.json`, `selecoes.json` (ocasiões, home, aliases),
  `kits.json`, `site.json` (cabeçalhos, vitrines, frentes, contato, temporada).
- **Já funcionava e foi preservado**: busca e filtros do catálogo com estado na URL, "Ver mais" com volta ao ponto,
  troca de cor por foto real, seleção persistente (`localStorage: tama-selecao`, só peça/cor/ocasião/quantidade, sem
  dados pessoais), gaveta da seleção, foto ampliada, formulário com id de pedido idempotente e sucesso só com
  `{"gravado": true}`, WhatsApp oficial, consentimento de cookies e GA4 só após aceite, JSON-LD, sitemap, redirecionamentos.
- **Problemas encontrados**: CSS legado com 140 KB acumulados em ondas ("onda 3", "apresentação 20/10"…), com regras
  de cabeçalho em vários media queries e um comentário sem fechamento que engolia regras; paleta creme/verde/bordô e
  Playfair; menu organizado por linha de produto (Brindes/Kits/Confecções/Eventos/Sobre/Blog) com hotelaria escondida
  dentro de Brindes; barra superior verde com três compromissos repetidos em todas as páginas.

## Inventário de páginas migradas

Todas as rotas usam o mesmo `shell()` (cabeçalho, rodapé, gaveta, cookies), então todas mudaram juntas.

| Rota | Modelo | Situação |
|---|---|---|
| `/` | `page_home` | Reconstruída (abertura `ms-*` em três cenas, galeria e seções `tm-*`) |
| `/catalogo/` | `page_catalogo` + `catalogo_block` | Restilizada (filtros, contagem, etiquetas removíveis, vazio) |
| `/catalogo/<modelo>/` (176) | `page_produto` | Restilizada; troca de foto com esmaecimento; fundo no tom da cor |
| `/kits-corporativos/` | `page_kits` | Restilizada |
| `/brindes-corporativos/`, `/confeccoes-personalizadas/`, `/eventos-corporativos/`, `/hotelaria-e-gastronomia/` | páginas de frente | Restilizadas (cabeçalho com foto, atalhos, vitrines, processo, FAQ) |
| `/brindes-de-fim-de-ano/`, `/brindes-por-ocasiao/` | campanhas e ocasiões | Restilizadas; conteúdo preservado |
| `/sobre/`, `/blog/` e artigos | institucional e blog | Restilizados; URLs preservadas |
| `/solicitar-proposta/`, `/obrigado/`, `/privacidade/`, `/404.html` | formulário e utilitárias | Restilizadas; quantidade editável na seleção |
| `/admin/` | editor e inventário | Inalterado (tem CSS próprio) |

Nenhuma URL mudou; nenhum redirecionamento novo foi necessário.

## Navegação

Produtos ▾ (categorias com contagem, brindes por tipo, vestuário, catálogo completo) · Kits ▾ (por contexto) ·
Soluções ▾ (as cinco frentes) · Inspirações ▾ (ocasiões, fim de ano, brindes por ocasião, guias) · Sobre. À direita:
busca (lupa abre o campo com foco), Minha seleção com contador e Solicitar proposta. Abre por clique e teclado; o hover
só complementa (com espera ao sair e uma ponte invisível entre botão e painel); Esc fecha e devolve o foco. No celular
(< 1024 px) o menu ocupa a tela abaixo do cabeçalho, com busca no topo, acordeões e a proposta no fim.

## Tokens (src/v3.css)

- Cor: `--c-bg #FFF`, `--c-bg-2 #F6F7F9`, `--c-surface #EEF0F3`, `--c-ink #17191C`, `--c-ink-2 #59616C`, `--c-line #E1E5EA`,
  `--c-field #858E99`, `--c-brand #76263E`, `--c-brand-2 #5C1D30`, `--c-dark #17191C`, `--c-on-dark-2 #B4BBC4`, `--c-error #B3261E`.
  `--tint` por elemento: cor da peça (cards, página do produto, categorias, arco da cena principal), misturada ao branco
  com `color-mix()`; a foto de estúdio entra em `multiply`, então a peça não muda de cor.
- Tipo: `--t-display` 40→84 px, `--t-h2` 28→48 px, `--t-lead`, `--t-ui`, `--t-small` (clamp). Manrope 500–800 e DM Sans
  400–700 locais em WOFF2 (latin + latin-ext), `font-display: swap`, fallbacks métricos. A Playfair ficou só no /admin/.
- Espaço 4/8/12/16/24/32/48/64/96; largura máxima 1320 px; raios 8/14/22/pílula; duas sombras.
- Movimento: `--ease cubic-bezier(.22,1,.36,1)`, 150 ms (controles), 240 ms (menus), 320 ms (componentes), 560 ms (seções).
- Os tokens do legado (`--wine`, `--ivory`, `--forest`, `--f-serif`…) apontam para os novos: `styles.css` segue
  servindo os componentes de página sem divergir.

### Contraste (WCAG, medido)

Texto sobre branco 17,6:1 · texto secundário sobre branco 6,3:1 e sobre `#F6F7F9` 5,9:1 · bordô sobre branco e branco
sobre botão bordô 9,9:1 (hover 12,6:1) · contorno de campo 3,3:1 · texto secundário sobre escuro 9,1:1 · erro 6,5:1.

## Componentes

Cabeçalho, menus (painéis largos/acordeão), busca, breadcrumbs, botões (`btn-wine`, `btn-line`, `btn-dark`, `btn-sm`,
estados hover/foco/pressionado/desabilitado/ocupado), link, chips, campos e mensagens de erro, card de produto com
seletor de cor e "+ Selecionar" (confirmação: toast, pulso no botão e no contador), card de categoria, de frente e de
guia, galeria do produto com miniaturas/vistas e foto ampliada, filtros e etiquetas, gaveta da seleção com quantidade
editável, estados vazios/erro/sucesso do formulário, acordeões, chamada final, rodapé, assinatura da marca, primitivas
de movimento (`data-reveal`, flutuação pausável).

## Movimento

- Abertura da home no padrão da prévia aprovada ("Estudo de movimento / 03", 08/11/2026): três cenas com peças reais
  recortadas (garrafa térmica, caderno de anotações, ecobag), cada uma com palavra grande, halo, órbitas ou linhas,
  marcadores e entrada própria (1,5 s); troca a cada 7 s com barra de progresso, botões com miniatura e pausa. A troca
  automática pausa ao passar o mouse, fora da tela, com a aba oculta, ao escolher uma peça e, com movimento reduzido,
  começa pausada. Paralaxe leve só com mouse; modo de contraste opcional. Na garrafa, as cores trocam a foto real
  (pré-carregada; se falhar, mantém a atual) e acompanham texto alternativo e link. Sem rotação 360°.
- Galeria de coleções (escolha do cliente, 08/11/2026): uma peça recortada por categoria, grande e solta, sem cartão,
  com setas, contador "01 — 09", barra de progresso e a lista de todas as categorias.
- Seções aparecem uma vez (opacidade + 18 px); sem JavaScript ou com `prefers-reduced-motion`, tudo fica visível e
  parado. Zoom de imagem 1,035 nos cards (desligado em toque). Só `transform` e `opacity`.
- Recortes (`tools/recortar.py`, `--vaos` para alças de bolsas): só as cores com recorte limpo entram na cena (azul royal, preto, laranja, verde, vermelho, rosa). Branco e
  prata têm pouco contraste com o fundo da foto e ficam só na página do produto, com as fotos originais.

## Verificação

- `tests/e2e.mjs` (dados de teste): **350 ok, 0 falhas**. Atualizados os testes que descreviam a home e o menu antigos;
  novos: troca de cor da cena (foto, nome, botão, alt, link), busca do cabeçalho com foco e Esc, menu nas cinco seções,
  página atual marcada, painéis inteiros em 1024 e 1440 px, ausência de rolagem lateral de 320 a 1440 px.
- Varredura própria (dados reais) em 360, 390, 768, 1024 e 1440 px por 18 páginas representativas: sem rolagem lateral,
  sem erro de console, sem requisição falha ou imagem quebrada, um H1 por página.
- Medições de desempenho (LCP/INP/CLS) **não** foram feitas; nada aqui afirma que as metas foram atingidas. O hero é uma
  imagem AVIF/WebP com largura/altura declaradas e `preload` com prioridade; as demais imagens são sob demanda.

## Pendências reais

- Inventário › Carrossel não controla mais a abertura da home (a cena é a garrafa do catálogo); os cabeçalhos das
  outras páginas seguem editáveis no inventário. Decidir se o carrossel sai do inventário.
- Kits: sem montagem animada (não há fotos das peças separadas de cada kit para compor a montagem sem inventar).
- Evidências: sem números, logotipos de clientes ou depoimentos comprovados; a home mostra só os compromissos de trabalho.
- Medir LCP/INP/CLS em laboratório (Lighthouse) e acompanhar dados reais depois da publicação.
- A assinatura "TaMa." em Manrope é texto (não SVG). Favicon, ícone e imagem de compartilhamento seguem com o SVG
  oficial. Se a marca nova virar oficial, gerar os SVGs dela em `brand/logos/`.
