# Banco de imagens de produto

Uma entrada por foto, fundo claro uniforme, quadrada (1024 ou 1254 px), com a identidade TaMa aplicada como exemplo.
É a **base única** do catálogo: a home, o `/catalogo/`, a página de ocasiões (`/brindes-por-ocasiao/`), as
páginas de frente e os artigos do blog leem os mesmos modelos daqui. Está preparado para, mais adiante, um marketplace.

## Onde está cada coisa
| Caminho | O que é |
|---|---|
| `src/data/produtos.json` | **Inventário: fonte da verdade.** Uma entrada por imagem, com produto, categoria, modelo, cor, material, técnica, texto alternativo, uso, aprovação, origem e hash do original. |
| `src/data/selecoes.json` | **Seleções editoriais** sobre o inventário (ver abaixo). Só guarda ids de modelo; nome, descrição, cores e fotos vêm sempre de `produtos.json`. |
| `midia/produtos/mestre/<id>.png` | Originais (PNG, 1024 ou 1254 px). Ficam só neste computador (fora do Git, como os masters dos mockups). |
| `img/produtos/<id>.webp` | Versão web (WebP, qualidade 92) que o build converte em AVIF/WebP/JPEG em vários tamanhos. O campo `arquivo` guarda o caminho público (`/img/produtos/…`); fotos enviadas pelo editor podem ter outro nome. |
| `midia/produtos/indice.html` | Índice visual gerado para revisão (não vai para o site). |
| `tools/produtos.py` | Importar, verificar e gerar o índice. |

## Editor do catálogo (/admin/)
Endereço: **https://tamacreative.com.br/admin/** (ou `/adm`), login com o GitHub, como no blog (ver `docs/BLOG.md`).
Em **Catálogo de produtos** fica o próprio `src/data/produtos.json`, uma entrada por foto:

- **Foto**: envia a imagem para `img/produtos/` (fundo claro, quadrada, de preferência 1254 px).
- **Produto, categoria, descrição do modelo**: fotos com o mesmo nome de produto formam um único modelo (um card no
  `/catalogo/`). Não escreva material nem capacidade no nome, na descrição ou no texto alternativo enquanto o material
  não estiver confirmado: o build recusa (ver "Regra do build" abaixo).
- **Cor**: nome e bolinha (seletor de cor, `#RRGGBB`).
- **Material e técnica**: valor + situação. Só aparece no site o que estiver **Confirmado**; o resto sai como
  "sob consulta". Vale para todo o site, porque todas as páginas leem o material e a técnica daqui.
- **Texto alternativo**, **situação da foto** (Substituir e Retirada tiram a foto do site), **onde é usada**.
- **Identificador**: deixe vazio em itens novos; o build gera `produto~cor`. Não mude o de itens existentes.

Em **Catálogo de produtos › Modelos** fica `src/data/modelos.json`, um cadastro por modelo (a página
`/catalogo/<nome>/`):
- **Produto:** escolhido entre os nomes do banco. Se renomear o produto nas fotos, ajuste aqui também; o build avisa.
- **Gênero:** define o título do Google ("Caneca personalizada", "Boné personalizado").
- **Resumo:** 2 ou 3 frases, mostradas abaixo do nome.
- **Ideal para:** até 4 usos, mostrados como etiquetas.
- **Medidas:** só aparecem com a situação **Confirmado**.
- **Título e descrição no Google:** opcionais; vazios, o site gera.

Os 52 resumos iniciais foram escritos sem afirmar material, técnica nem capacidade. Revise antes de aprovar.

Cada alteração vira um rascunho no fluxo de revisão (pull request no GitHub) e vai ao ar ao clicar em **Publicar**:
o build do GitHub Actions gera e testa o site, e o Easypanel publica (ver `docs/DEPLOY.md`). O build confere
categoria, cor, texto alternativo, se a foto existe e se algum texto afirma material sem confirmação: com erro, a
publicação não acontece e o motivo aparece no log do GitHub Actions (aba Actions do repositório). O editor regrava o
JSON com outra ordem de chaves e recuo de 2 espaços; isso não muda nada no site, e o `tools/produtos.py` volta ao
formato padrão na próxima vez que salvar.

Os originais em `img/produtos/` também são publicados em `/img/produtos/` (sem indexação), só para o editor mostrar a
foto; o site usa as versões AVIF/WebP/JPEG geradas pelo build.

## Modelos e seleções (`selecoes.json`)
**Modelo** = todas as fotos com o mesmo `produto`. O id do modelo é o nome sem acento, em minúsculas, com hífens:
"Polo masculina" → `polo-masculina`. Cada foto do modelo vira uma cor (bolinha) no card. Fotos `retirada` ou
`substituir` ficam de fora.

`src/data/selecoes.json` guarda só escolhas editoriais, sempre por id de modelo:

| Chave | O que define |
|---|---|
| `home` | Modelos que aparecem na home, na ordem. |
| `prioridade` | Ordem dos modelos dentro de cada categoria no catálogo (os que não estão na lista vêm depois, em ordem alfabética). |
| `foto_base` | A foto que abre o card de um modelo (`modelo: id da foto`). Sem ela, abre a foto original do modelo (a que não é variação de cor). |
| `ocasioes` | As ocasiões da página `/brindes-por-ocasiao/` (chave e nome). |
| `ocasioes_por_modelo` | Em quais ocasiões cada modelo aparece. Modelo sem ocasião não entra nessa página (continua no catálogo). |
| `aliases` | Slugs antigos (da home, da antiga curadoria e do catálogo) → id atual. Mantém funcionando seleções salvas no navegador, links antigos e peças de artigos. |

O build para se `selecoes.json` apontar para um modelo que não existe em `produtos.json`. As amostras das páginas
de frente (brindes, confecções, ativações, hotelaria) são listas de ids de modelo em `build.py` (`studio_block`).

Ao **renomear um produto**, o id do modelo muda: atualize `selecoes.json` e acrescente o id antigo em `aliases`.

## Regra do build: material não confirmado
Enquanto o `material` de uma foto estiver `a_confirmar`, os campos `produto`, `modelo` (descrição) e `alt` não podem
afirmar material nem capacidade. O build procura palavras como couro, acrílico, alumínio, inox, aço, algodão, piquet,
cerâmica, bambu, vidro, madeira, papel, plástico, metal, cera e capacidades em ml (expressão `SPEC_RE` em `build.py`)
e falha com a lista do que encontrou.

A especificação a confirmar fica no próprio inventário: em `material` e `tecnica` (com `status: a_confirmar`) e em
`observacao`, no formato `A confirmar com o fornecedor: couro ou sintético.` Quando o fornecedor confirmar, mude o
`status` para `confirmado`; aí o site mostra a especificação e o nome pode citá-la.

## Outras vistas: verso e close do bordado (18/10/2026)
- **Onde aparecem:** na página do produto, a faixa **Frente · Verso · Bordado** mostra as vistas da cor escolhida. No
  card, o verso da cor aparece ao passar o mouse.
- **No banco:** cada vista é uma entrada com `vista` = `verso` ou `detalhe` e o mesmo nome de cor da frente
  (`polo~azul-marinho-verso`, `polo~azul-marinho-bordado`).
- **Como fazer:**
  1. `tools/vistas.py gerar`: gera pela API, para UMA cor (a base), o verso, o close do bordado e a frente com bordado
     realista, com os prompts aprovados.
  2. `tools/recolorir.py`: faz as outras cores sem API (cor medida na foto de frente de cada cor). Requer numpy.
  3. `tools/vistas.py importar`: cadastra tudo no banco.
- **Feito:** 9 peças de vestuário, **60 versos e 57 closes do bordado**. Polo masculina e feminina, camiseta
  masculina e feminina, moletom com capuz e boné: verso nas 8 cores e bordado em 7 (o branco precisa da API, com o
  logo nas cores oficiais). Avental com laço: 7 versos e 6 bordados; dólmã: 5 versos e 4 bordados; avental: só o
  bordado (5 cores). Na polo masculina, as frentes também foram trocadas pela versão com bordado realista; a branca
  ficou como estava.

## Nome das imagens (id)
`<produto>[-<modelo>]~<cor>`, só minúsculas, números e hífen. Exemplos: `polo~vermelho`, `caneta-roller~bordo`,
`caneta-bambu~natural`, `jogo-americano-oval~taupe`. O `~` separa a cor: é a mesma convenção dos mockups, e o build trata
o que vem depois dele como variação de cor. Cada **modelo** é um produto; cor, tamanho e acabamento são variações. Não
criar uma entrada repetida por cor sem foto: a cor sem foto fica só como referência no site.

## Fluxo
**Nova imagem**
```bash
python -I tools/produtos.py importar ~/Downloads/foto.png --id caneca~preto --origem "Imagem gerada com IA (…) em dd/mm/aaaa"
```
O comando copia o original para `midia/produtos/mestre/`, gera `img/produtos/caneca~preto.webp` e cria a entrada no
inventário com os dados técnicos. Depois, preencha à mão no `produtos.json`: `produto`, `categoria`, `modelo`, `cor`
(nome e hex), `material`, `tecnica`, `alt`. A entrada nasce com `aprovacao: "revisao"`.

**Substituir uma imagem** (foto melhor, outro ângulo, produto corrigido)
```bash
python -I tools/produtos.py importar ~/Downloads/nova.png --id caneca~branco-v2 --substitui caneca~branco
```
A antiga passa a `retirada` e registra quem a substituiu; a nova entra em `revisao`. Se a antiga era a `foto_base` do
modelo em `selecoes.json`, troque pelo id novo e rode o build. O histórico fica no inventário.

**Conferir** (rode antes de cada commit que mexa no banco)
```bash
python -I tools/produtos.py verificar
```
Aponta: id repetido, arquivo ausente, original alterado sem reimportar (hash), campo obrigatório vazio, categoria
desconhecida, imagem em uso marcada como `substituir`/`retirada`, e lista o que está `a_confirmar` ou em revisão.

**Revisar e aprovar**
```bash
python -I tools/produtos.py indice      # abre midia/produtos/indice.html no navegador
```
Depois de ver a imagem, mude `aprovacao` para `aprovada` (ou `substituir`, com o motivo em `observacao`).

## Campos do inventário
| Campo | Uso |
|---|---|
| `id`, `arquivo`, `mestre`, `largura`, `altura`, `bytes`, `sha256`, `atualizado_em` | Técnicos; o `importar` preenche. |
| `produto`, `categoria`, `modelo` | Catálogo. Categorias: `vestuario`, `canetas-escritorio`, `tecnologia`, `bolsas-embalagens`, `garrafas-copos`, `acessorios`, `casa-bem-estar`, `hotelaria-gastronomia`. |
| `cor` `{nome, hex}` | A cor da foto, como referência para o visitante. Sem declaração de estoque. |
| `material`, `tecnica` `{valor, status}` | `status`: `a_confirmar` (sugestão editorial) ou `confirmado` (com fornecedor). **O site não publica um valor `a_confirmar` como especificação definitiva.** |
| `alt` | Texto alternativo da imagem no site. |
| `uso` | Registro de onde a imagem é usada (`catalogo`, `home`, `kits`…). Vazio vira `catalogo` no build. O que aparece em cada página é decidido por `selecoes.json` e pelas listas em `build.py`, não por este campo. |
| `ilustrativa` | `true` para imagem gerada ou simulada. O site sempre apresenta como ilustrativa. |
| `aprovacao` | `revisao` → `aprovada` \| `substituir` \| `retirada`. |
| `origem` | De onde veio (ferramenta, data, fornecedor, fotógrafo). |
| `substitui` | id da imagem que esta substituiu. |
| `vista` | Vazio = frente (a foto da cor no card e na galeria). `verso` ou `detalhe` (close do bordado): outras vistas da mesma cor, só na página do produto e no verso do card. |
| `fornecedor`, `sku`, `estoque` | Vazios nesta fase (catálogo consultivo). Já existem para a fase de marketplace: SKU real do fornecedor, estoque e preço entram aqui, não no site estático. |
| `observacao` | Avisos editoriais e a especificação a confirmar (`A confirmar com o fornecedor: …`). |

## Variações de cor e produtos novos com IA
`tools/variacoes.py` chama a API de imagens da OpenAI (modelo `gpt-image-1.5`). A chave vem de `OPENAI_API_KEY` ou de
`~/.config/tama/openai.env` (fora do Git). Cada imagem custa dinheiro; confira o preço antes de um lote.
```bash
python -I tools/variacoes.py caneca~branco "Azul royal" "#1F4FB8" Preto "#1E1E1E"      # variações de cor de uma foto do banco
python -I tools/variacoes.py novo copo-papel~preto "a matte black paper coffee cup..." --logo /caminho/logo-tama.png --qualidade high
```
`novo` cria um produto a partir da descrição, com uma foto do banco como referência de enquadramento e luz e o logo
oficial como segunda imagem (sem isso o modelo erra o "CREATIVE"). Peça produtos opacos e coloridos: transparentes
puxam o fundo para o escuro. **Nunca envie fotos de terceiros como referência**: o produto é descrito em texto, para não
reproduzir material nem marcas alheias. As imagens saem em 1024 px; importe com `tools/produtos.py importar`.

## Estado em 18/10/2026
**346 imagens, 52 modelos**: 229 de frente (uma por cor) + 60 de verso e 57 de close do bordado (`vista`). Todas
ilustrativas (geradas com IA), todas com `aprovacao: revisao` e com material e técnica `a_confirmar`. Todas as frentes
aparecem no `/catalogo/`; a home, a página de ocasiões, as páginas de frente e os artigos do blog mostram recortes dos
mesmos modelos.

Pendências de dados (lista completa em `docs/PENDENCIAS.md` › Confirmações de produto): confirmar material, técnica e
capacidade dos 52 modelos; confirmar os dez modelos reais de caneta com o fornecedor; identificar o material (EVA ou
PVC) e o modelo do saquinho transparente; couro legítimo ou sintético (agenda, cardápio, carteira, chaveiro com tira, estojo, nécessaire, porta-canetas, vela); acrílico e
capacidade das taças; aprovar as 346 fotos; conferir as fotos refeitas com o logo oficial em 17/10/2026 (carteira, chaveiro com tira, caneta
natural e outras 44; `tools/logo_ajuste.py`).
