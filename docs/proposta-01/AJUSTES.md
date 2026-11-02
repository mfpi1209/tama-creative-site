# Proposta 01 na /v2/ — implementação e diferenças

Pacote: `TAMA-artes-e-prompt.zip` (TAMA-kit-visual), recebido em 02/11/2026. Referência: `home-aprovada.png`
(nesta pasta). Medidas de partida: `VISUAL.md` (nesta pasta).

## Onde está

- Página: `/v2/` (fora do Google e do sitemap). A home atual (`/`) não muda.
- Código: `build.py` (`page_home_v2`, `v2_hero`, `v2_solucoes`, `v2_catalogo`, `v2_processo`, `v2_faq`, `v2_guias`).
- Estilos: `src/styles.css`, bloco "proposta 01", todo sob `body.v2` ou classes `t-*` usadas só na /v2/.
- Filtros: `src/site.js`, bloco "/v2/ (proposta 01)".
- Fotos: `img/v2/` com os nomes do pacote (hero, kits, garrafas, canecas, cadernos, ecobags, vestuario,
  guia-fim-de-ano, guia-boas-vindas, guia-compliance). PNGs originais; o build gera AVIF/WebP/JPG.
  Hashes conferidos com `manifesto.json`.

## O que segue o pacote

- Ordem: faixa utilitária, cabeçalho com busca, navegação verde, hero de fim de ano, soluções com cinco
  ícones, catálogo 3×2, processo, perguntas, guias, chamada bordô e rodapé.
- Hero fixo (sem carrossel), com "Fim de ano" no lugar da anotação "01 · Soluções compactas".
- Catálogo: Kits corporativos, Garrafas, Canecas, Cadernos, Ecobags e Vestuário, nessa ordem. O card inteiro
  leva a uma página real: `/kits-corporativos/`, `/catalogo/?tipo=garrafas`, `?tipo=canecas`, `?tipo=cadernos`,
  `?tipo=ecobags` e `/confeccoes-personalizadas/`. Filtros Todos, Kits, Dia a dia e Vestuário pelas tags
  locais do guia (kits / garrafas, canecas, cadernos, ecobags / vestuário), com `aria-pressed`.
- Perguntas com `details`/`summary`. As cinco primeiras são as da home atual (`HOME_FAQ`); a sexta, "Como
  funciona a aprovação da arte?", usa textos que o site já tinha (pergunta de brindes e etapa "Aprovação").
- Guias: os três artigos que já existem no blog, com as fotos novas.
- Chamada e rodapé: os do site (formulário, WhatsApp e contatos reais).

## Diferenças em relação à referência

- Tipografia: no mockup, textos e títulos ficam cerca de 20% acima dos números do `VISUAL.md`. A 1440 px foram
  aumentados para aproximar a referência (título do hero até 68 px, títulos de seção até 58 px, nomes dos
  cards até 36 px, links 17 px, filtros 40 px de altura). Os valores estão no bloco "Ajustes medidos contra a
  referência" do CSS.
- Fontes: as do site (serif e sans já usadas), não as substitutas do pacote (Cormorant Garamond e DM Sans).
- Cabeçalho e rodapé: os do site, com o logotipo oficial, a busca real e o botão "Seleção" (não aparece no
  mockup, mas é uma função do site).
- Fotos: recriadas pelo pacote, não idênticas ao mockup; o hero aparece um pouco menos ampliado que na
  referência.
- Celular, tablet: o pacote não tem mockup móvel aprovado; seguem as regras do `VISUAL.md` (catálogo 2 colunas
  até 768 px e 1 coluna até 479 px, processo 2×3, perguntas e guias em 1 coluna).

## Pendências

- Hero fixo de fim de ano: fora da temporada, o texto e a foto precisam ser trocados (hoje não vêm do admin).
- Xícaras, porta-vinho: não fazem parte do catálogo 3×2 do pacote.
