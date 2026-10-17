# Banco de imagens de produto

Uma foto por peça, fundo claro uniforme, 1254 × 1254 px, com a identidade TaMa aplicada. O banco alimenta a home hoje e
está preparado para o catálogo completo, a manutenção das fotos e, mais adiante, um marketplace.

## Onde está cada coisa
| Caminho | O que é |
|---|---|
| `src/data/produtos.json` | **Inventário: fonte da verdade.** Uma entrada por imagem, com produto, categoria, modelo, cor, material, técnica, texto alternativo, uso, aprovação, origem e hash do original. |
| `midia/produtos/mestre/<id>.png` | Originais (PNG, 1254 px). Ficam só neste computador (fora do Git, como os masters dos mockups). |
| `img/produtos/<id>.webp` | Versão web (WebP, qualidade 92) que o build converte em AVIF/WebP/JPEG em vários tamanhos. Só as imagens **em uso** entram no site. |
| `src/data/home-produtos.json` | Apresentação da home: quais imagens aparecem, em que ordem, com que texto. Aponta para os ids do inventário. |
| `midia/produtos/indice.html` | Índice visual gerado para revisão (não vai para o site). |
| `tools/produtos.py` | Importar, verificar e gerar o índice. |

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
A antiga passa a `retirada` e registra quem a substituiu; a nova entra em `revisao`. Troque o id nos lugares que a usam
(`home-produtos.json`) e rode o build. O histórico fica no inventário.

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
| `produto`, `categoria`, `modelo` | Catálogo. Categorias: `vestuario`, `canetas-escritorio`, `bolsas-embalagens`, `garrafas-copos`, `acessorios`, `casa-bem-estar`, `hotelaria-gastronomia`. |
| `cor` `{nome, hex}` | A cor da foto, como referência para o visitante. Sem declaração de estoque. |
| `material`, `tecnica` `{valor, status}` | `status`: `a_confirmar` (sugestão editorial) ou `confirmado` (com fornecedor). **O site não publica um valor `a_confirmar` como especificação definitiva.** |
| `alt` | Texto alternativo da imagem no site. |
| `uso` | Onde a imagem aparece: `home`, depois `curadoria`, `catalogo`… Vazio = fora do site (não entra no build). |
| `ilustrativa` | `true` para imagem gerada ou simulada. O site sempre apresenta como ilustrativa. |
| `aprovacao` | `revisao` → `aprovada` \| `substituir` \| `retirada`. |
| `origem` | De onde veio (ferramenta, data, fornecedor, fotógrafo). |
| `substitui` | id da imagem que esta substituiu. |
| `fornecedor`, `sku`, `estoque` | Vazios nesta fase (catálogo consultivo). Já existem para a fase de marketplace: SKU real do fornecedor, estoque e preço entram aqui, não no site estático. |
| `observacao` | Avisos editoriais (ex.: "não chamar de couro legítimo sem confirmação"). |

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

## Estado em 17/10/2026
64 imagens: 40 geradas com IA (ferramenta informada: Sol 6.1 Leve) cobrindo os 38 modelos do catálogo inicial e 2
variações de cor; 16 variações de cor (caneca, squeeze, copo e garrafa térmica) e 8 produtos novos (taças de acrílico,
copo 360°, copos de café inox e de papel, copo térmico de vinho, jogo americano impresso) gerados com `tools/variacoes.py`. Todas em `revisao`, com material e técnica `a_confirmar`.
Todas em uso: 16 na home (`src/data/home-produtos.json`), as 38 modelos no catálogo da curadoria (`/brindes-corporativos-premium/#catalogo`, gerado de `produtos.json` por `build_catalogo()` em `build.py`) e amostras nas páginas de brindes e confecções (`studio_block`).

Pendências de dados (do catálogo inicial): confirmar os dez modelos reais de caneta com o fornecedor; identificar o
material e o modelo do saquinho de EVA/PVC; confirmar material das peças de hotelaria (não chamar de couro legítimo);
capa dura × couro podem virar modelos separados depois da confirmação.
