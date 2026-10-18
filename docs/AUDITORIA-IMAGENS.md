# Auditoria das imagens: incoerências e prompts de correção

**Data:** 18/10/2026. **Versão:** branch `qa-final` igual à `home-limpa` (51df595) + as correções deste documento.
**Escopo:** as 229 fotos do banco (`src/data/produtos.json`), usadas no /catalogo/, na home, na curadoria e nas páginas
de frente, e as 28 imagens de página (carrossel, kits, cenas de Confecções, coleções, blog).

**Método**
1. **Medição automática de cada foto:**
   - cor medida × cor declarada (ΔE em Lab);
   - cor do fundo nos cantos;
   - área ocupada pela peça;
   - semelhança entre fotos (hash).
2. **Folhas de contato** com o nome e a bolinha da cor declarada de cada foto.
3. **Revisão ampliada do logo, foto a foto:** grafia, desenho, cor e tamanho.
4. **Conferência com os SVGs oficiais** em `brand/logos/`.
5. **Leitura dos textos** (nome, modelo, texto alternativo) contra a foto.

## 1. Resumo

O banco tem um padrão visual bom e consistente, e isso deve ser preservado:
- fundo creme claro (#FBF8F5 em 229 de 229);
- luz suave e uma peça por foto;
- enquadramento parecido;
- uma foto própria para cada cor.

As incoerências estão em cinco pontos:

| # | Incoerência | Quantas | Gravidade |
|---|---|---|---|
| 1 | Logo com desenho ou grafia errada ("CREEATIIVE", fonte sem serifa, folha solta) | 6 fotos | Alta: é a marca da TaMa mal escrita |
| 2 | Logo fora das cores oficiais em peças claras (cinza, preto, "TaMa" vermelho ou azul, branco invisível em cru) | 15 fotos | Alta |
| 3 | Produto ou modelo que não bate com o nome (copo "360°" é copo de papel; dois nomes para a mesma caneta) | 4 fotos + 2 modelos | Média |
| 4 | Tamanho do logo fora da proporção (enorme nas taças e no difusor, minúsculo no jogo americano oval e no avental de bolso) | ~25 fotos | Média |
| 5 | Duas direções de arte no site: estúdio claro (atual) × editorial antigo em travertino com logo dourado em layouts não oficiais; kits quase todos em bordô | 7 + 7 imagens de página | Média: confunde a identidade |

Também havia uma incoerência de texto, **já corrigida** (seção 2): mais de cem variações de cor tinham o texto alternativo
copiado da foto-base, como "Camiseta feminina **vermelha**" nas 8 cores e "Garrafa térmica **vermelha**" nas 5.

## 2. Corrigido nesta rodada (no código, sem gerar imagens)

- **Texto alternativo das 229 fotos reescrito:**
  - descreve o que se vê, na cor certa de cada foto (ex.: "Camisa polo masculina, na cor azul royal, com a marca TaMa no
    peito.");
  - não afirma mais material nem técnica ainda `a_confirmar` (sem "couro", "silk", "bordada", "aço inox", "acrílico",
    "baixo-relevo").
- **Linha "modelo" dos cards sem material, capacidade e técnica**, porque todos estão `a_confirmar`:
  - "Taça balão 600 ml, acrílico" passou a "Taça balão";
  - "Copo reutilizável 430 ml, acrílico…" passou a "Reutilizável, estampa envolvente".

  Material e técnica continuam aparecendo no site quando forem marcados como **Confirmado** no editor (/admin/).
- **Destaques da home:** a foto principal e as variações de cor usam o texto alternativo do catálogo. Antes vinham de
  cópias em `home-produtos.json`, todas com a cor da foto-base. Agora há uma fonte só, editável no /admin/.

## 3. Regra oficial do logo (dos SVGs em `brand/logos/`)

| Superfície | Versão oficial | Cores |
|---|---|---|
| Branca ou clara (branco, cru, creme, kraft claro, prata) | Positivo (`tama-logo-horizontal-positivo`) | Folha coral **#D5483A**, "TaMa" ameixa **#65253D**, "CREATIVE" coral |
| Escura ou saturada | Negativo (`…-negativo`) **ou** mono branco (`…-mono-branco`) | Negativo: folha coral, "TaMa" creme **#F7F3ED**, "CREATIVE" malva **#B98892**. Mono: tudo branco |
| Couro e sintético | Relevo seco tom sobre tom (ou hot stamping) | Mesma cor do material, um pouco mais escura ou clara |
| Vestuário bordado ou silk em 1 cor | Sem a linha "CREATIVE" (pequena demais para bordar), como já faz `tools/cenas.py` | Mono branco no escuro; positivo no claro |

O logo **nunca** sai cinza, preto chapado, com "TaMa" vermelho ou azul, nem branco sobre cru ou creme.

**Proporção:**
- peças rígidas: largura do logo de 1/4 a 1/3 da face visível da peça;
- vestuário: peito, até ~9 cm na peça real;
- taças: no máximo 45% do bojo.

**Decisão pendente:** no fundo escuro, hoje as fotos alternam entre negativo (folha coral) e mono branco. As duas
versões são oficiais, mas misturadas parecem descuido. Sugestão:
- **negativo** em peças impressas (copos, jogos americanos, sacolas, guarda-chuva);
- **mono branco** em bordado, silk e gravação a laser.

O modo `fiel` de `tools/logo_ajuste.py` hoje pede "tudo branco no escuro"; ajuste o texto do prompt depois da decisão.

## 4. Lista priorizada por foto

Ferramentas, já no repositório: `tools/logo_ajuste.py` (modos `fiel`, `menor`, `oficial`), `tools/variacoes.py`
(variação de cor ou produto novo) e `tools/cenas.py`. Depois de gerar, importe com
`python -I tools/produtos.py importar midia/produtos/geradas/<id>.png --id <id>` e rode o build.

### P1: corrigir antes de divulgar

| Foto(s) | Problema (conferido na ampliação) | Ação |
|---|---|---|
| `caneta-bambu~natural` | "CREATIVE" escrito **"CREEATIIVE"** | `logo_ajuste.py fiel` |
| `chaveiro-couro~cafe`, `chaveiro-couro~preto` | "TaMa" e "CREATIVE" **sem serifa**, folha de outro desenho (folha com nervura) | `logo_ajuste.py oficial` (relevo seco) |
| `agenda-couro~cafe` | "CREATIVE" com um ponto no meio ("CRE·ATIVE") | `logo_ajuste.py fiel` |
| `caneta-kraft~natural` | Folha solta, longe do "TaMa" (layout errado) | `logo_ajuste.py fiel` |
| `polo~branco`, `polo-feminina~branco`, `camiseta-feminina~branco`, `bone~branco`, `squeeze~branco`, `garrafa-termica~branco`, `copo-termico~branco`, `caneta-plastica~branco` | Logo **cinza ou preto** em peça branca | `logo_ajuste.py fiel` (positivo) |
| `taca-gin-acrilico~branco`, `taca-vinho-acrilico~branco` | "TaMa" **vermelho** em vez de ameixa | `logo_ajuste.py fiel` |
| `sacola-presente~cru` | "TaMa" **azul-marinho** | `logo_ajuste.py fiel` |
| `avental~cru`, `caixa-personalizada~cru` | Logo **branco sobre cru**, quase invisível | `logo_ajuste.py fiel` (positivo) |
| `copo-acrilico-360~bordo` | "TaMa" rosado e folha creme, **e** o copo saiu vermelho vivo, não bordô | Gerar de novo a partir de `copo-acrilico-360~azul-marinho` com `variacoes.py` ("Bordô" "#6B1E33") |
| Selo do rodapé e de /sobre/ (`tama-selo-positivo.svg`) | O anel diz **"BRINDES · CONFECÇÕES · MARCAS"** | Arte nova "BRINDES · KITS · CONFECÇÕES" (designer). Até lá, usar só o símbolo |

### P2: coerência de produto e de cor

| Foto(s) | Problema | Ação |
|---|---|---|
| `copo-acrilico-360~*` (4) | A foto mostra **copo de papel** (borda enrolada, parede fosca), mas o id e a descrição falam em reutilizável | Decidir: (a) renomear para "Copo de papel com impressão 360°" e ajustar o modelo; ou (b) gerar um copo reutilizável de plástico rígido (prompt 5.3) |
| `caneta-executiva~*` × `caneta-giro~*` | Mesma silhueta (só brilhante × fosca), mas aparecem como dois modelos | Confirmar com o fornecedor; se forem o mesmo, juntar num produto só com acabamentos; se forem diferentes, gerar a de giro com corpo distinto (prompt 5.4) |
| `taca-champagne-acrilico~*` (4), `taca-vinho-acrilico~azul-royal/~bordo/~preto/~branco`, `difusor~ambar/~natural`, `caneca~verde`, `copo-termico-vinho~azul-marinho/~verde` | Logo grande demais (55% a 80% da largura; nas flutes a folha encosta no "T") | `logo_ajuste.py menor` |
| `jogo-americano-oval~*` (6), `avental~*` (7, logo no bolso), `estojo-couro~*` | Logo pequeno demais ("CREATIVE" ilegível) | `logo_ajuste.py fiel` pedindo o dobro do tamanho atual (ajustar o texto: "about one quarter of the width") |
| `bone~rosa`, `moletom~rosa`, `avental-laco~rosa` | Saem rosa-salmão, enquanto a bolinha #E07A9B é rosa-chiclete | Mais barato: ajustar o hex da cor "Rosa" no /admin/ para o tom da foto, em todas as peças rosa |
| "Caramelo" (#A0623A) em `porta-lapis`, `cardapio`, `jogo-americano-*` | Cada foto tem um caramelo diferente (de laranja-queimado a bege) | Medir e padronizar um hex por família de material; ou renomear ("Laranja queimado") onde o tom for outro |
| `dolma~azul-marinho`, `dolma~jeans` | Marinho claro demais; "jeans" sem textura de denim | `variacoes.py` a partir de `dolma~branco` com "Azul-marinho" "#1E2A4A" e "Jeans (denim texture)" "#2F4470" |
| "Azul royal" (#1F4FB8) em `polo`, `camiseta-feminina`, `squeeze` | A foto é um azul mais vivo que a bolinha (ΔE 17 a 24) | Ajustar o hex da cor "Azul royal" para o tom das fotos (um só para todas as peças) |
| `jogo-americano-impresso~*` (4) | Fundo branco frio, diferente do creme das outras 225 fotos | Regenerar ou corrigir o fundo para #FBF8F5 |

### P3: refinamento

| Foto(s) | Problema | Ação |
|---|---|---|
| `caneta-roller~prata`, `chaveiro-abridor~prata` | Logo branco sobre prata, pouco contraste | Gravação a laser escura (positivo em 1 cor) |
| `vela~couro` | O id diz "couro", a cor é "Caramelo" | Renomear o id para `vela~caramelo` com o `importar --substitui` |
| `cartao~creme`, `lacre~dourado` | Logo em dourado e lacre só com a folha | Aceitável como acabamento (hot stamping, lacre); manter |

## 5. Imagens de página

| Imagem | Onde | Incoerência | Sugestão |
|---|---|---|---|
| `hero-gift`, `embalagem-presente`, `kit-presente`, `kit-papelaria`, `papelaria-cores`, `caderno-azul`, `caneca-ceramica` | Capas e cards do blog, /brindes-corporativos/, coleções da curadoria, `og-default.jpg` (compartilhamento de todas as páginas) | Direção de arte antiga (travertino, sombras fortes, terracota/mostarda/oliva). Os logos aparecem dourados, com a folha **acima** do "TaMa", e numa fita lilás com "TaMa" repetido, layouts que não seguem o horizontal oficial | Substituir pelo estilo atual (estúdio claro) ou por cenas de uso; começar pelo `og-default.jpg` e pelas capas do blog (prompt 5.6) |
| `kitp-*` (5 kits), `kitp-kit-completo`, `hero-kits`, `home-kits`, `home-card-brindes` | Home, /kits-corporativos/, carrossel | Quase tudo em **bordô e caramelo**, a cor da TaMa. Sugere que os kits saem na cor da TaMa, e não na do cliente (já apontado na auditoria anterior, P1-9) | Gerar os kits em 3 paletas variadas (prompt 5.5); usar `editorial-kit-cores` como referência, que já está certa |
| `conf-equipe-kits` | Confecções, slide 1 | Texto alternativo: "montando kits **num ateliê claro**". Sugere produção própria da TaMa | Trocar por cena de uso pelo cliente (prompt 5.7) ou mudar o texto para "Equipe de uma empresa usando polos e camisetas com a marca" |
| `conf-estande-evento` | Confecções | A TaMa aparece como **expositora** de feira | Aceitável como exemplo; melhor com marca fictícia de cliente |
| `caneca-ceramica`, `caderno-azul--casa-mirelo` | Blog, curadoria | Marca fictícia "Casa Mirelo" ao lado de peças TaMa | Manter só onde houver a legenda "marca fictícia" (a curadoria tem; as capas do blog não) |

## 6. Prompts de criação (inglês, para `gpt-image-1.5`)

Os prompts seguem o padrão que já gerou o banco. Sempre envie o **logo oficial em PNG** como segunda imagem (`--logo`) e
nunca fotos de terceiros como referência.

### 6.1 Prompt-base de foto de catálogo (produto novo: `variacoes.py novo`)
```text
Catalog product photo of ONE {product description, shape and parts, no brand names}, color {color name} ({hex}).
Square 1:1, product centered and fully visible, occupying about 45-55% of the frame, three-quarter view from slightly
above, soft diffused studio light from the upper left, soft natural contact shadow, seamless warm off-white background
#FBF8F5, no props, no text other than the logo.
Apply the logo from the second image exactly as drawn (red/coral leaf on the LEFT, serif wordmark "TaMa", small
letter-spaced "CREATIVE" underneath; spell C-R-E-A-T-I-V-E), {placement}, with its width about one third of the visible
face of the product. On white or light surfaces use the original colors (coral leaf #D5483A, plum wordmark #65253D).
On dark or saturated surfaces use {"the official negative version: coral leaf, cream wordmark, mauve CREATIVE" | "all
white"}. On leather use a subtle tone-on-tone blind deboss. The logo must follow the curvature and perspective of the
surface like a real print. Photorealistic, premium e-commerce quality, no watermark.
```

### 6.2 Corrigir logo mantendo tudo (`logo_ajuste.py fiel`), para os P1 de cor e grafia
O prompt do modo `fiel` já está certo. Para as peças **claras**, acrescente ao fim:
```text
This product is white/light: the leaf must be coral #D5483A and the wordmark "TaMa" dark plum #65253D, never grey,
black, red or blue. Check the spelling letter by letter: T-a-M-a and C-R-E-A-T-I-V-E.
```
Comandos (lote P1):
```bash
python -I tools/logo_ajuste.py fiel caneta-bambu~natural caneta-kraft~natural agenda-couro~cafe polo~branco polo-feminina~branco camiseta-feminina~branco bone~branco squeeze~branco garrafa-termica~branco copo-termico~branco caneta-plastica~branco taca-gin-acrilico~branco taca-vinho-acrilico~branco sacola-presente~cru avental~cru caixa-personalizada~cru --logo <logo-positivo.png>
```
```bash
python -I tools/logo_ajuste.py oficial chaveiro-couro~cafe chaveiro-couro~preto --logo <logo-positivo.png>
```

### 6.3 Logo menor (`logo_ajuste.py menor`), P2
```bash
python -I tools/logo_ajuste.py menor taca-champagne-acrilico~azul-royal taca-champagne-acrilico~branco taca-champagne-acrilico~preto taca-champagne-acrilico~vermelho taca-vinho-acrilico~azul-royal taca-vinho-acrilico~bordo taca-vinho-acrilico~preto taca-vinho-acrilico~branco difusor~ambar difusor~natural caneca~verde copo-termico-vinho~azul-marinho copo-termico-vinho~verde --logo <logo-positivo.png>
```
Para as taças, acrescente: `On a flute or wine glass the logo is at most 45% of the bowl width, with clear space between
the leaf and the "T".`

### 6.4 Copo reutilizável com impressão 360° (se a TaMa vender esse e não o de papel)
```text
Catalog product photo of ONE reusable rigid plastic party cup (smooth glossy polypropylene wall, slightly tapered,
thick rounded rim, NO rolled paper rim, NO lid), wrapped edge to edge with a subtle tone-on-tone geometric pattern in
{color} ({hex}). Same studio standard as 6.1. Logo from the second image printed on the front, all white, width one
third of the cup.
```

### 6.5 Caneta "de giro" distinta da executiva (se forem modelos diferentes)
```text
Catalog product photo of ONE slim twist-action ballpoint pen, matte {color} metal body with a thin chrome twist ring in
the MIDDLE of the barrel, flat chrome top cap, short straight chrome clip, NO stylus tip, lying diagonally. Same studio
standard as 6.1. Logo laser-engraved small on the barrel, white.
```

### 6.6 Kits em cores de cliente (substitui o domínio do bordô)
Gerar 3 versões de cada kit (Gelato Experience, Mesa de Descobertas, Kit Prático, Em Movimento, Pausa e Inspiração),
cada uma numa paleta diferente: (A) azul-marinho + areia; (B) verde-floresta + creme; (C) preto + mostarda.
```text
Premium corporate gift kit photographed from 3/4 above on a light warm stone surface, soft daylight, plenty of air,
warm off-white background. Rigid presentation box in {palette main color} with lid open, interior in {palette second
color}, containing: {kit items}. All items share the same palette ({main}, {second}, natural steel/wood/glass); NO
burgundy, NO wine red. Small printed card "Feito para você". The logo from the second image appears on the lid inside
and small on 2 items, following the logo color rule (coral leaf + plum on light surfaces, all white on dark ones). No
other brands, no text other than the logo and the card. Photorealistic, catalog quality.
```

### 6.7 Cena de uso pelo cliente (`cenas.py`, substitui o "ateliê")
```bash
python -I tools/cenas.py conf-equipe-uso "A team of four colleagues of different ages and ethnicities at their own modern office reception, wearing matching navy polo shirts with the logo on the chest, welcoming a visitor; daylight, plants, laptop desk; it is clearly a client office, not a workshop or a packing area." --logo <logo-positivo.png>
```

### 6.8 Capa do blog e imagem de compartilhamento no estilo atual
```text
Wide 3:2 editorial still life on a seamless warm off-white background #FBF8F5: {3-4 catalog items of the article theme},
arranged with generous empty space on the LEFT half for a headline, soft daylight from the left, gentle shadows.
Products in varied client colors (navy, forest green, sand, black), each with the official logo following the color rule
and at catalog proportion. No travertine, no gold foil, no ribbons with text. Photorealistic.
```

## 7. Checklist de aceite das imagens

- [ ] Nenhuma foto com logo cinza, preto chapado, "TaMa" vermelho ou azul, ou branco sobre cru ou creme.
- [ ] "CREATIVE" legível e correto em todas as fotos onde aparece; serifa no "TaMa"; folha à esquerda.
- [ ] Logo entre 1/4 e 1/3 da face (taças ≤ 45% do bojo; vestuário no peito).
- [ ] `python -I tools/auditar_imagens.py` com os avisos conferidos (peças brancas e canetas podem dar falso aviso de cor) (cor da bolinha × cor da foto com ΔE ≤ 15, fundo, enquadramento); folhas de contato em `midia/produtos/auditoria/` revisadas a olho.
- [ ] Fundo #FBF8F5 em todas as fotos do catálogo.
- [ ] Nenhum produto com nome ou descrição que contradiga a foto.
- [ ] Na primeira dobra da home e de Kits, peças em pelo menos 3 cores sem relação com a paleta da TaMa.
- [ ] Selo sem "MARCAS".
- [ ] `og-default.jpg` e capas do blog no estilo de estúdio atual.
- [ ] Depois de importar: aprovar as fotos no /admin/ (Situação da foto → Aprovada).
