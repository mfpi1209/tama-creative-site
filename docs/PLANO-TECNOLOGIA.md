# Plano: categoria Tecnologia no catálogo

Proposta do `curador-tecnologia` (18/10/2026), **para o dono aprovar** antes de qualquer imagem gerada. O catálogo
tem hoje 67 modelos em 7 categorias e nenhuma de tecnologia; o atalho "Tecnologia" saiu de `/brindes-corporativos/`
porque não havia peças. Este plano traz a categoria de volta com 10 modelos, todos ilustrativos e com as
especificações "a confirmar na proposta".

**O que o dono decide:**
1. Aprovar (ou cortar) a lista de 10 modelos da seção 2.
2. Aprovar o custo da seção 5 e a qualidade (recomendação: bases em `high`, cores em `medium`).
3. Confirmar com os fornecedores o que está na seção 6 (capacidade, potência, certificações, prazo). Até lá, o site
   não mostra nenhum desses dados.

---

## 1. A categoria nova (especificação para o `dev-front-build`)

**Chave:** `tecnologia` · **Rótulo:** "Tecnologia" · **Posição sugerida:** logo depois de "Canetas e escritório"
(afinidade de uso; não muda os 12 primeiros cards do `/catalogo/`, que são de vestuário e canetas).

| Onde | O que mudar | Observação |
|---|---|---|
| `build.py` › `CAT_PROD` | acrescentar `'tecnologia': 'Tecnologia'` depois de `'canetas-escritorio'` | A ordem do dicionário define a ordem do catálogo, dos filtros e do submenu. |
| `build.py` › `CAT_TEXTO` | `'tecnologia': 'Itens de tecnologia para a rotina de quem trabalha no escritório, em casa ou em trânsito: pen drives, power banks, carregadores, fones, caixas de som e organizadores. Capacidade, potência, compatibilidade e aplicação da marca são confirmadas na proposta.'` | Texto para o `editor-seo-conteudo` revisar. Sem números nem material. |
| `build.py` › `CAT_USO` | `'tecnologia': 'para equipes, eventos e kits'` | Idem. |
| `build.py` › `BRINDES_ATALHOS` | acrescentar `(CAT_PROD['tecnologia'], '/catalogo/?categoria=tecnologia')` e trocar o comentário "Tecnologia volta quando houver peças no catálogo" | Passam a ser 5 atalhos; conferir o layout em `src/styles.css` (celular e desktop). Só ligar **depois** de as fotos estarem no banco, senão o atalho abre um filtro vazio. |
| `build.py` › filtros e menu | nada a fazer: o filtro lateral (`cats`), os chips da curadoria, o submenu "Catálogo" e o `data-cat` dos cards leem `CAT_PROD` | O submenu "Catálogo" ganha um item (8 categorias + "Catálogo completo"): avisar o `arquiteto-ux-navegacao` e o QA. |
| `blog.py` › editor `/admin/` | nada a fazer: o select de categoria usa `CAT_PROD` | O e2e pode conferir `value: tecnologia` no `config.yml`. |
| `build.py` › `SPEC_RE` (sugestão) | acrescentar capacidades tech: `\d+\s?(?:gb|tb|mah|w)` e `bluetooth\s?\d` | Faz o build recusar "32 GB", "10.000 mAh", "15 W" em nome, descrição ou alt enquanto o material estiver `a_confirmar`. |
| `tools/produtos.py` › `CATEGORIAS` | acrescentar `'tecnologia'` | Sem isso o `verificar` acusa "categoria desconhecida". Aplicar **antes** de importar as fotos. |
| `docs/BANCO-IMAGENS.md` › Campos do inventário | incluir `tecnologia` na lista de categorias | Dono: `curador-catalogo-imagens`. |
| `src/site.js` | nada obrigatório; `?categoria=tecnologia` já passa no filtro (`[a-z-]`) | Opcional: em `ANTIGOS.cat`, mapear `tech` → `tecnologia` se houver links antigos. |
| `tests/e2e.mjs` | total de modelos `67` → `77` (H1 "77 modelos", "Mostrando 12 de 77"); novo teste `?categoria=tecnologia` mostra 10 modelos e o contador do filtro diz `10`; atalhos de `/brindes-corporativos/` têm 5 links, um deles `/catalogo/?categoria=tecnologia`; `config.yml` tem `value: tecnologia` | Se a lista final tiver outro número de modelos, ajustar. |

Ordem de aplicação: `tools/produtos.py` (CATEGORIAS) e `CAT_PROD` → importação das fotos → `BRINDES_ATALHOS` e
contagens do e2e → build e e2e nos dois modos da temporada.

---

## 2. Os 10 modelos iniciais

Regras que valem para todos:
- **Nome e descrição neutros**: o que a peça é e para que serve. Sem GB, mAh, W, versão de bluetooth, "carga rápida",
  certificação, "compatível com…" nem material (o build recusa madeira, bambu, metal, plástico, couro…).
- `material` e `tecnica` com `status: a_confirmar`; a `observacao` lista o que falta (`A confirmar com o fornecedor: …`).
- **Base colorida** sempre que possível: a logo sai branca e as variações herdam. As versões brancas tendem a precisar de
  `tools/logo_ajuste.py fiel` para voltar às cores oficiais (folha coral, "TaMa" ameixa): está na reserva de custo.
- **Logo** com cerca de **1/3 da face visível**, centralizada, longe de bordas, portas, tampas e da área de apoio do
  celular; **branca** em peça colorida ou escura; cores oficiais em peça branca; gravação tom sobre tom no pen drive
  natural. Peças muito pequenas (os fones em si) não levam logo: ela vai no estojo.
- Cores com nome e hex do `src/data/plano-cores.json`. Única cor nova: **Natural `#C9A86A`** (a mesma da
  `caneta-bambu~natural`), para o pen drive natural.

| # | Nome de exibição (gênero) | Id da foto-base | Descrição (campo `modelo`) | Cor-base | Cores extras | Onde vai a logo | Falta confirmar |
|---|---|---|---|---|---|---|---|
| 1 | Pen drive cartão (m) | `pen-drive-cartao~azul-royal` | Formato de cartão, com área ampla para a marca | Azul royal `#1F4FB8` | Preto, Vermelho, Branco | Centro da face do cartão, branca, 1/3 da largura | capacidade, conector, material, técnica |
| 2 | Pen drive giratório (m) | `pen-drive-giratorio~preto` | Tampa giratória que protege o conector | Preto `#1E1E1E` | Azul royal, Vermelho, Verde | Face do corpo colorido, branca, 1/3 do comprimento visível (fora da tampa) | capacidade, material da tampa, técnica |
| 3 | Pen drive natural (m) | `pen-drive-natural~natural` | Corpo em tom natural, com tampa | Natural `#C9A86A` (nova) | Café, Caramelo | Face do corpo, gravação tom sobre tom (marrom escuro, sem cor), 1/3 do comprimento | madeira ou bambu, capacidade, técnica |
| 4 | Power bank slim (m) | `power-bank-slim~preto` | Formato fino, para levar na bolsa ou no bolso | Preto `#1E1E1E` | Azul-marinho, Prata, Branco | Centro da face maior, branca, 1/3 da largura, longe das portas | capacidade, saídas, certificação, bateria |
| 5 | Power bank com ventosas (m) | `power-bank-ventosa~azul-royal` | Ventosas no verso para prender ao celular durante a recarga | Azul royal `#1F4FB8` | Preto, Branco, Rosa | Centro da face frontal (o verso tem as ventosas), branca, 1/3 da largura | capacidade, cabo integrado ou não, certificação |
| 6 | Carregador sem fio de mesa (m) | `carregador-sem-fio-mesa~preto` | Suporte inclinado que mantém o celular à vista na mesa | Preto `#1E1E1E` | Branco, Azul-marinho | Frente da base (abaixo do apoio do celular), branca, 1/3 da largura da base | potência, compatibilidade, cabo e fonte inclusos, certificação |
| 7 | Fone de ouvido sem fio (m) | `fone-sem-fio~branco` | Fones intra-auriculares com estojo de recarga | Branco `#F7F5F0` | Preto, Azul-marinho, Rosa | Tampa do estojo, cores oficiais (branca nas variações), 1/3 da largura da tampa; nada nos fones | versão de bluetooth, autonomia, certificação |
| 8 | Headphone (m) | `headphone~preto` | Arco acolchoado e conchas sobre as orelhas | Preto `#1E1E1E` | Branco, Azul-marinho, Cinza | Face externa da concha voltada à câmera, branca, 1/3 do diâmetro | com ou sem fio, autonomia, certificação |
| 9 | Caixa de som (f) | `caixa-de-som~azul-marinho` | Formato compacto, com alça, para a mesa ou a viagem | Azul-marinho `#1E2A4A` | Preto, Vermelho, Cinza | Frente do corpo, branca, 1/3 da largura visível | potência, autonomia, resistência à água, certificação |
| 10 | Estojo organizador de tecnologia (m) | `estojo-tecnologia~azul-marinho` | Divisórias para cabos, carregador e power bank | Azul-marinho `#1E2A4A` | Preto, Cinza, Verde-escuro | Centro da tampa, branca, 1/3 da largura | material, divisórias internas, técnica |

Total: **10 fotos-base + 28 cores = 38 imagens** (os pen drives natural e o carregador têm 2 extras; os demais, 3).

**Segunda onda** (fora deste lote, se a primeira for bem): power bank de mesa, hub de portas, adaptador de tomada
para viagem, suporte de celular dobrável, mouse pad e uma foto de grupo do "kit home office tech".

### Texto alternativo e resumo (rascunho para o `editor-seo-conteudo`)
Padrão de alt: `<Nome> <cor> com a marca TaMa <onde>`, com concordância (ex.: "Caixa de som vermelha com a marca TaMa
na frente"; "Pen drive cartão preto com a marca TaMa na face"). O `gerar_cores.py` só troca o nome da cor no alt da
base: **revisar a concordância** das variações da caixa de som (feminino) e qualquer alt que diga "na cor …".

| Modelo | Resumo (rascunho, 2 frases) | Ideal para |
|---|---|---|
| Pen drive cartão | Do tamanho de um cartão, guarda apresentações, catálogos e materiais de evento com a marca bem à vista. Capacidade e acabamento são definidos na proposta. | Eventos, Feiras, Lançamentos |
| Pen drive giratório | A tampa gira e protege o conector, sem peça solta para perder. Uma opção prática para entregar conteúdo em eventos e treinamentos. | Eventos, Treinamentos, Campanhas |
| Pen drive natural | Corpo em tom natural, para quem quer um brinde de visual mais leve. Material e capacidade são confirmados na proposta. | Eventos, Lançamentos |
| Power bank slim | Fino o bastante para ir na bolsa ou no bolso e recarregar o celular fora do escritório. Capacidade e saídas são confirmadas na proposta. | Boas-vindas, Eventos, Equipes externas |
| Power bank com ventosas | As ventosas prendem o power bank ao celular e deixam a recarga mais prática em trânsito. Especificações confirmadas na proposta. | Eventos, Campanhas, Boas-vindas |
| Carregador sem fio de mesa | Mantém o celular apoiado e à vista na mesa de trabalho, com a marca na base. Potência e compatibilidade são confirmadas na proposta. | Presentes executivos, Fim de ano, Home office |
| Fone de ouvido sem fio | Fones com estojo de recarga, que acompanham a rotina em chamadas, deslocamentos e treinos. A marca vai na tampa do estojo. | Presentes executivos, Fim de ano, Reconhecimento |
| Headphone | Para chamadas e foco no trabalho, com a marca na concha. Conexão e autonomia são confirmadas na proposta. | Presentes executivos, Reconhecimento |
| Caixa de som | Compacta e com alça, vai da mesa para a viagem. Um presente de uso pessoal que leva a marca para fora do escritório. | Fim de ano, Reconhecimento |
| Estojo organizador de tecnologia | Reúne cabos, carregador e power bank num só lugar, na mochila ou na mala. Combina com kits de boas-vindas e de viagem. | Boas-vindas, Viagens, Kits corporativos |

---

## 3. Prompts de geração (`tools/variacoes.py novo`)

O texto abaixo entra no `{desc}` do prompt `NOVO` do `variacoes.py`, que já pede o fundo #F6F2EC uniforme de borda a
borda, a mesma luz, a logo oficial letra por letra, nenhuma outra marca, nenhum outro texto e nenhuma pessoa. O
posicionamento da logo vai em `--aplicacao`. Estilo: `--estilo caneca~branco` (padrão); logo: PNG exportado de
`brand/logos/tama-logo-horizontal-positivo.svg`. Comando-modelo:

```bash
~/Projetos/tama-brindes/.venv/bin/python -I tools/variacoes.py novo <id> "<desc>" --aplicacao "<aplicacao>" --logo <logo-positivo.png> --qualidade high
```

Trechos comuns (já incluídos em cada `desc`): `ONE … only, opaque matte finish, fully visible, centered, about 45-55%
of the frame, three-quarter view from slightly above, seamless flat uniform warm off-white background #F6F2EC from
edge to edge, soft contact shadow, no cables, no phone, no packaging, no props, no other brands, no text other than
the logo`. Em peça colorida, `--aplicacao` pede a logo **inteira em branco**; em peça branca, nas cores oficiais.

**1. `pen-drive-cartao~azul-royal`**
- desc: `ONE credit-card-shaped USB flash drive only, thin flat card with rounded corners and a small fold-out USB connector at one short edge, color royal blue (#1F4FB8), opaque matte finish, lying at a slight angle, fully visible, centered, about 45-55% of the frame, three-quarter view from slightly above, seamless flat uniform warm off-white background #F6F2EC from edge to edge, soft contact shadow, no cables, no laptop, no props, no other brands, no text other than the logo`
- aplicacao: `entirely in white (leaf, TaMa and CREATIVE), printed centered on the front face of the card, with its width about one third of the card width, clear of the edges and the connector, following the surface like a real print`

**2. `pen-drive-giratorio~preto`**
- desc: `ONE swivel USB flash drive only: a compact rectangular body in black (#1E1E1E) with a brushed silver swivel cover rotated open to show the connector, opaque matte body, fully visible, centered, about 45-55% of the frame, three-quarter view from slightly above, seamless flat uniform warm off-white background #F6F2EC from edge to edge, soft contact shadow, no keyring, no cables, no props, no other brands, no text other than the logo`
- aplicacao: `entirely in white, printed centered on the flat face of the black body (not on the silver cover), with its width about one third of the visible body length, clear of the edges`

**3. `pen-drive-natural~natural`**
- desc: `ONE USB flash drive only with a rectangular light natural wood-grain body (#C9A86A) and a matching cap, rounded edges, fully visible, centered, about 45-55% of the frame, three-quarter view from slightly above, seamless flat uniform warm off-white background #F6F2EC from edge to edge, soft contact shadow, no cables, no props, no other brands, no text other than the logo`
- aplicacao: `as a tone-on-tone laser engraving in dark brown (no color, no white), centered on the flat face of the body, with its width about one third of the body length, following the wood grain like a real engraving`

**4. `power-bank-slim~preto`**
- desc: `ONE slim rectangular power bank only, very thin with rounded edges, color black (#1E1E1E), opaque soft matte finish, a small row of plain indicator dots and one port on a short edge with no labels, standing slightly angled, fully visible, centered, about 45-55% of the frame, three-quarter view from slightly above, seamless flat uniform warm off-white background #F6F2EC from edge to edge, soft contact shadow, no cables, no phone, no props, no other brands, no text other than the logo`
- aplicacao: `entirely in white, printed centered on the large front face, with its width about one third of the face width, clear of the edges, the indicator dots and the port`

**5. `power-bank-ventosa~azul-royal`**
- desc: `ONE compact rectangular power bank only, smaller than a phone, with rounded edges and a grid of small suction cups on the back panel, visible from the side, color royal blue (#1F4FB8), opaque matte finish, standing slightly angled to show the front face, fully visible, centered, about 45-55% of the frame, three-quarter view from slightly above, seamless flat uniform warm off-white background #F6F2EC from edge to edge, soft contact shadow, no cables, no phone, no props, no other brands, no text other than the logo`
- aplicacao: `entirely in white, printed centered on the smooth front face (the side without suction cups), with its width about one third of the face width, clear of the edges and the port`

**6. `carregador-sem-fio-mesa~preto`**
- desc: `ONE desk wireless charging stand only: an inclined flat back panel for a phone with a small front ledge, on a low rectangular base, color black (#1E1E1E), opaque matte finish, empty with no phone on it, fully visible, centered, about 45-55% of the frame, three-quarter view from slightly above, seamless flat uniform warm off-white background #F6F2EC from edge to edge, soft contact shadow, no cables, no props, no other brands, no text other than the logo`
- aplicacao: `entirely in white, printed centered on the front edge of the base, below the phone ledge, with its width about one third of the base width, so it stays visible when a phone is resting on the stand`

**7. `fone-sem-fio~branco`**
- desc: `ONE set of true wireless in-ear earbuds with their charging case: a compact rounded pill-shaped case with the lid closed, and the two matching earbuds resting just in front of it, all in white (#F7F5F0), opaque glossy-satin finish, fully visible, centered, about 45-55% of the frame, three-quarter view from slightly above, seamless flat uniform warm off-white background #F6F2EC from edge to edge, soft contact shadow, no cables, no phone, no props, no other brands, no text other than the logo`
- aplicacao: `in the official colors (coral leaf #D5483A, plum wordmark #65253D), printed centered on the top of the case lid, with its width about one third of the lid width; no logo on the earbuds`
- nas variações coloridas, conferir na folha de contato se a logo ficou **inteira branca**; se não, `logo_ajuste.py`.

**8. `headphone~preto`**
- desc: `ONE pair of over-ear headphones only, padded headband and round cushioned ear cups, color black (#1E1E1E), opaque matte finish, standing upright with the outer face of one ear cup turned toward the camera, fully visible, centered, about 45-55% of the frame, three-quarter view from slightly above, seamless flat uniform warm off-white background #F6F2EC from edge to edge, soft contact shadow, no cable, no stand, no props, no other brands, no text other than the logo`
- aplicacao: `entirely in white, printed centered on the outer face of the ear cup turned to the camera, with its width about one third of the cup diameter, following the curve of the cup`

**9. `caixa-de-som~azul-marinho`**
- desc: `ONE compact portable cylindrical speaker only, wrapped in a fine woven fabric cover, with a short carrying strap loop at the top end and plain round buttons without symbols, color navy blue (#1E2A4A), opaque, standing upright, fully visible, centered, about 45-55% of the frame, three-quarter view from slightly above, seamless flat uniform warm off-white background #F6F2EC from edge to edge, soft contact shadow, no cables, no phone, no props, no other brands, no text other than the logo`
- aplicacao: `entirely in white, printed centered on the front of the body, with its width about one third of the visible front width, following the curve of the cylinder and the fabric texture`

**10. `estojo-tecnologia~azul-marinho`**
- desc: `ONE closed rectangular zippered tech organizer case only, semi-rigid with rounded corners, a zipper running around the edge with a small pull tab and a short side carry handle, color navy blue (#1E2A4A), opaque fine-textured matte finish, lying flat at a slight angle, fully visible, centered, about 45-55% of the frame, three-quarter view from slightly above, seamless flat uniform warm off-white background #F6F2EC from edge to edge, soft contact shadow, no cables or devices visible, no props, no other brands, no text other than the logo`
- aplicacao: `entirely in white, printed centered on the top face of the case, with its width about one third of the top width, clear of the zipper and the edges`

### Cores (para o `curador-catalogo-imagens` acrescentar ao `plano-cores.json`)
Em `cores`: `"Natural": "#C9A86A"`. Em `paleta`:

```json
"pen-drive-cartao~azul-royal": ["Preto", "Vermelho", "Branco"],
"pen-drive-giratorio~preto": ["Azul royal", "Vermelho", "Verde"],
"pen-drive-natural~natural": ["Café", "Caramelo"],
"power-bank-slim~preto": ["Azul-marinho", "Prata", "Branco"],
"power-bank-ventosa~azul-royal": ["Preto", "Branco", "Rosa"],
"carregador-sem-fio-mesa~preto": ["Branco", "Azul-marinho"],
"fone-sem-fio~branco": ["Preto", "Azul-marinho", "Rosa"],
"headphone~preto": ["Branco", "Azul-marinho", "Cinza"],
"caixa-de-som~azul-marinho": ["Preto", "Vermelho", "Cinza"],
"estojo-tecnologia~azul-marinho": ["Preto", "Cinza", "Verde-escuro"]
```

Depois das bases importadas: `tools/gerar_cores.py --listar` (sem custo, deve mostrar 28) e
`tools/gerar_cores.py --so <ids-base> --qualidade medium`. No pen drive natural, Café e Caramelo são tons do mesmo
acabamento natural; a gravação continua tom sobre tom.

---

## 4. Ocasiões e kits

Chaves de `selecoes.json › ocasioes_por_modelo` (só ocasiões que já existem):

| Modelo (id) | Ocasiões | Kits sugeridos |
|---|---|---|
| `pen-drive-cartao` | eventos, lancamentos, campanhas | material de evento e de lançamento (apresentação, catálogo, press kit) |
| `pen-drive-giratorio` | eventos, campanhas | kit de treinamento; brinde de feira |
| `pen-drive-natural` | eventos, lancamentos | lançamento com proposta de visual natural |
| `power-bank-slim` | boas-vindas, eventos, campanhas | Em Movimento; boas-vindas |
| `power-bank-com-ventosas` | eventos, campanhas, boas-vindas | ativações e eventos ao ar livre |
| `carregador-sem-fio-de-mesa` | executivos, fim-de-ano, reconhecimento, boas-vindas | Kit Prático; kit home office tech |
| `fone-de-ouvido-sem-fio` | executivos, fim-de-ano, reconhecimento | presente executivo; fim de ano |
| `headphone` | executivos, reconhecimento, fim-de-ano | reconhecimento de equipe; home office |
| `caixa-de-som` | fim-de-ano, reconhecimento, executivos | fim de ano; premiação de campanha interna |
| `estojo-organizador-de-tecnologia` | boas-vindas, executivos, fim-de-ano | Em Movimento; boas-vindas; kit home office tech |

- **Kits existentes** (`HOME_KITS` em `build.py`, descrições do `dev-front-build`): "Em Movimento" pode citar power bank
  slim e estojo organizador; "Kit Prático" pode citar o carregador sem fio de mesa. Só mudar o texto quando os kits
  tiverem foto com essas peças; hoje as fotos dos kits não as mostram.
- **Kit novo (proposta):** "Home Office Tech": estojo organizador, power bank slim, carregador sem fio de mesa, caderno
  e caneta com ponta touch, em caixa com a marca do cliente. Precisa de uma foto de kit (cena `high`, fora deste
  lote) antes de entrar em `/kits-corporativos/`.
- **Prioridade no catálogo** (`selecoes.json › prioridade`, dentro da categoria): power bank slim, fone sem fio,
  carregador sem fio de mesa, estojo organizador, headphone, caixa de som, power bank com ventosas, pen drive cartão,
  pen drive giratório, pen drive natural (os pen drives por último).
- **`foto_base`**: o id da base de cada modelo (tabela da seção 2).
- **Página de brindes** (opcional): trocar 1 ou 2 dos 12 modelos do `studio_block` de `/brindes-corporativos/` por
  `power-bank-slim` e `fone-de-ouvido-sem-fio`, mantendo 12 (o e2e conta 12).

---

## 5. Custo estimado

Referência das ferramentas: cerca de **US$ 0,12 por imagem em `medium`** e **US$ 0,25 em `high`** (`gpt-image-1.5`,
1024 × 1024). Conferir a tabela vigente da OpenAI antes de rodar.

| Lote | Imagens | `medium` (≈ US$ 0,12) | `high` (≈ US$ 0,25) |
|---|---|---|---|
| Fotos-base (`variacoes.py novo`) | 10 | US$ 1,20 | US$ 2,50 |
| Cores (`gerar_cores.py`) | 28 | US$ 3,36 | US$ 7,00 |
| **Subtotal** | **38** | **US$ 4,56** | **US$ 9,50** |
| Reserva: logo das versões brancas (`logo_ajuste.py fiel`: cartão, slim, ventosas, carregador, headphone) e das 3 cores do fone | 8 | US$ 0,96 | US$ 2,00 |
| **Total com reserva** | **46** | **US$ 5,52** | **US$ 11,50** |

**Recomendação:** bases em `high` (US$ 2,50) e cores em `medium` (US$ 3,36), mais a reserva em `medium` (US$ 0,96):
**cerca de US$ 6,82** para as 38 imagens do catálogo. Se uma base falhar na folha de contato, refazer custa mais
US$ 0,25 cada; as cores só começam depois de as 10 bases passarem.

---

## 6. Riscos e cuidados

- **Pen drive meio obsoleto.** Hoje o conteúdo circula por link e nuvem. Posicionar o pen drive como **opção de
  baixo custo para eventos, feiras e treinamentos**, que entrega a apresentação, o catálogo ou o material do evento
  já gravado, e não como presente principal. Por isso entra por último na ordem da categoria e não aparece em
  presentes executivos. Se o dono preferir, a linha começa só com o pen drive cartão (corta 2 modelos e 7 imagens,
  cerca de US$ 0,84 em `medium`).
- **Especificação técnica.** Capacidade (GB, mAh), potência (W), versão de bluetooth, autonomia, compatibilidade e
  "carga rápida" variam por fornecedor e por lote. Nada disso aparece no site: tudo fica "a confirmar na proposta" e
  vai para `docs/PENDENCIAS.md` › Confirmações de produto. A sugestão de `SPEC_RE` da seção 1 trava esses números.
- **Compliance de eletrônicos.** Power banks, carregadores, fones e caixas de som podem exigir homologação e
  certificação no Brasil (por exemplo, Anatel para itens com rádio ou carregamento, e regras de segurança de baterias).
  A TaMa precisa confirmar com cada fornecedor quais certificados o item tem antes de oferecer; o site não cita
  certificação. Baterias de lítio também têm regras próprias de transporte, que podem afetar o envio de kits.
- **Prazo de importação.** Boa parte dos eletrônicos personalizados vem de importação, e o prazo pode ser maior do que o
  das outras categorias, sobretudo perto do fim de ano. Nenhum prazo é publicado: "definido na proposta". A TaMa pode
  avaliar trabalhar com estoque nacional do fornecedor para pedidos com prazo curto (a confirmar).
- **Área de gravação pequena.** Pen drives, fones e power banks têm pouca área: a logo do cliente pode precisar da
  versão reduzida (só o símbolo) e de uma cor só. Isso é dito na proposta, não no catálogo.
- **Imagens.** Todas ilustrativas, `aprovacao: revisao`, material e técnica `a_confirmar`. Risco de a IA desenhar
  portas com símbolos, números ou marcas: os prompts proíbem texto além da logo, e a folha de contato recusa o que
  sair com qualquer inscrição. Nenhuma foto de fornecedor como referência.

## 7. Próximos passos (depois do OK)
1. `dev-front-build`: `CATEGORIAS` em `tools/produtos.py` e `CAT_PROD`, `CAT_TEXTO`, `CAT_USO` em `build.py`.
2. `curador-catalogo-imagens`: 10 bases (`novo`), folha de contato, importação com a categoria `tecnologia`, depois o
   `plano-cores.json` e as 28 cores; `modelos.json` (gênero, resumo, usos) e `selecoes.json` (ocasiões, prioridade,
   `foto_base`).
3. `editor-seo-conteudo`: revisa resumos, alts e o texto da categoria.
4. `dev-front-build`: atalho "Tecnologia" em `BRINDES_ATALHOS` e contagens do e2e (77 modelos, 10 na categoria).
5. QA nos dois modos da temporada; o dono aprova as fotos e confirma as especificações com os fornecedores.
