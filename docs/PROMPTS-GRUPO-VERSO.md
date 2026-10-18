# Fotos de grupo, verso e detalhe: padrão, prompts e lista

**Data:** 18/10/2026. A tabela da seção 4 foi calculada a partir de `src/data/produtos.json` e `src/data/home-produtos.json`
nesta data (52 produtos, 229 fotos de frente). Ainda não há nenhuma foto de grupo, verso ou detalhe no banco.

## 1. O que são e como entram no site

Cada foto do banco tem o campo **`vista`** (no /admin/: **Vista**). Sem o campo, vale `frente`.

| Vista | O que mostra | Onde aparece |
|---|---|---|
| `frente` | Uma peça numa cor (a foto de hoje) | Bolinha de cor no card e na página do produto |
| `grupo` | Todas as cores do produto juntas | O card do catálogo abre nela, com "N cores", e ela é a 1ª miniatura da galeria ("Todas as cores") |
| `verso` | A mesma peça, na mesma cor, vista de trás ou do outro lado | Ao passar o mouse no card (só o verso da cor em que o card abre) e na galeria ("Verso") |
| `detalhe` | Close de acabamento, peça aberta etc. | Só na galeria da página do produto ("Detalhe") |

O card e a galeria agrupam pelo campo **`produto`**: a foto de grupo ou verso precisa ter o nome do produto **idêntico**
ao das fotos de frente (ex.: "Polo masculina").

**Cadastro pelo /admin/** (Catálogo de produtos → nova entrada):
- Foto: o PNG gerado; Produto, Categoria e Descrição do modelo: iguais aos da frente.
- **Vista**: Grupo, Verso ou Detalhe.
- **Cor**: grupo → nome **"Todas as cores"** (o hex pode ficar com o da cor-base; o site não o usa); verso → **o mesmo
  nome de cor da foto de frente** (ex.: "Vermelho"), com o mesmo hex. É pelo nome que o site liga o verso à cor.
- Texto alternativo, ex.: "Polo masculina em oito cores, lado a lado, com a marca TaMa no peito." / "Costas da polo
  masculina vermelha, sem estampa."
- Onde é usada: Catálogo. Identificador: pode deixar vazio, mas prefira o padrão abaixo.

**Cadastro pela linha de comando** (mesmo fluxo de `docs/BANCO-IMAGENS.md`):
```bash
python -I tools/produtos.py importar midia/produtos/geradas/polo~todas-as-cores.png --id polo~todas-as-cores --origem "Foto de grupo gerada com IA (OpenAI gpt-image-1.5, edição a partir das fotos de frente) em dd/mm/aaaa. Ilustrativa: não é foto do produto final."
python -I tools/produtos.py importar midia/produtos/geradas/polo~vermelho-verso.png --id polo~vermelho-verso --origem "Verso gerado com IA (OpenAI gpt-image-1.5, edição a partir de polo~vermelho) em dd/mm/aaaa. Ilustrativa."
```
Depois, no `produtos.json`, preencha à mão `produto`, `categoria`, `modelo`, `cor`, `alt`, `uso: ["catalogo"]` (o
`importar` cria com `uso` vazio, e vazio fica fora do site) e acrescente **`"vista": "grupo"`** ou **`"vista": "verso"`**.
Rode `python -I tools/produtos.py verificar` e o build.

**Ids:** `<prefixo>~todas-as-cores` para grupo, `<prefixo>~<cor>-verso` para verso, `<prefixo>~<cor>-detalhe-<n>` para
detalhe. O prefixo é o da frente (parte antes do `~`, coluna "prefixo" da tabela).

## 2. Regras das fotos

**Comuns (iguais às fotos de frente, ver `docs/AUDITORIA-IMAGENS.md` §6.1):**
- fundo de estúdio liso, creme quente **#FBF8F5** de borda a borda, sem degradê nem vinheta;
- quadrada **1:1** (sai em 1024 px);
- mesma luz suave e difusa vinda do alto à esquerda, sombra de contato suave;
- mesma altura de câmera e vista três-quartos levemente de cima;
- nada além do produto: sem objetos de cena, embalagem, texto ou marca d'água;
- **pré-requisito:** gere só depois de corrigir as fotos de frente daquele produto apontadas em
  `docs/AUDITORIA-IMAGENS.md` §4 (logo, cor, tamanho do logo). O grupo copia as frentes, inclusive os erros.

**Grupo:**
- todas as cores com foto, lado a lado, em leque ou escadinha (composição sugerida na tabela);
- **número de peças = número de cores**, uma de cada, sem repetir e sem cor extra;
- todas na mesma escala, nenhuma cortada pela borda; o conjunto ocupa ~65–75% do quadro;
- cada peça com o logo oficial na regra de cor de `docs/AUDITORIA-IMAGENS.md` §3: positivo (folha coral #D5483A,
  "TaMa" ameixa #65253D) em peça clara; negativo (folha coral, "TaMa" creme, "CREATIVE" malva) em impressos escuros;
  mono branco em bordado, silk e laser escuros; relevo seco tom sobre tom em couro e sintético. Nunca cinza, preto
  chapado, "TaMa" vermelho ou azul, nem branco sobre cru;
- logo legível em pelo menos metade das peças (as de trás podem ficar parcialmente cobertas).

**Verso:**
- o mesmo produto, **na mesma cor** da frente, girado 180° no mesmo lugar (mesmo enquadramento e escala);
- mostra o que o produto real tem atrás (costas da camisa, regulador do boné, contracapa da agenda);
- **sem logo**, salvo se o produto real tiver marca ali (raro: etiqueta de nuca, gravação na contracapa). Na dúvida,
  sem logo; marca nas costas é personalização que se combina na proposta;
- um verso por produto, da **cor-base** (a cor em que o card abre; coluna "Cores" da tabela). Outros versos só sob
  demanda.

**Detalhe:** sem lote previsto. Sob demanda (ex.: cardápio ou caixa abertos, close do bordado), com o mesmo padrão
de fundo e luz.

## 3. Prompts (edição com as fotos de frente como referência)

O endpoint de edição aceita várias imagens no campo `image[]`. `edit()` em `tools/variacoes.py` já faz isso: a 1ª é
`base_png` e as seguintes vão em `extras=` (é assim que `novo` passa o logo oficial). A documentação da OpenAI fala em
até 16 imagens por chamada no `gpt-image-1`; confira o limite do `gpt-image-1.5` antes do lote (o maior caso aqui é 8
cores + logo = 9). Use as frentes de `midia/produtos/mestre/` (originais), nunca as WebP do site, e **nunca fotos de
terceiros**.

### 3.1 Comando a acrescentar em `tools/variacoes.py` (proposta, ainda não implementado)
```bash
python -I tools/variacoes.py grupo <prefixo> "<composição em inglês>" --logo <logo-positivo.png> [--qualidade high] [--saida midia/produtos/geradas]
python -I tools/variacoes.py verso <id-da-frente> "<o que mostrar atrás, em inglês>" [--logo <logo.png> --aplicacao "<onde>"] [--qualidade high]
```
- `grupo`: lê o `produtos.json`, pega as fotos `vista` frente cujo id começa **exatamente** com `<prefixo>~` (fora
  `retirada`/`substituir`), põe a cor-base primeiro, chama `edit(key, modelo, qualidade, <frente-base>, PROMPT_GRUPO,
  fidelidade='high', extras=[<demais frentes>..., <logo>])` e grava `<prefixo>~todas-as-cores.png`. Monta a lista de
  cores do prompt (nome + hex) a partir do JSON.
- `verso`: usa a frente `<id>` como 1ª imagem (logo só se `--logo` for passado) e grava `<id>-verso.png`.
- Ex.: `python -I tools/variacoes.py grupo polo "eight folded polo shirts in a diagonal staircase, collars and chest logos visible" --logo <logo-positivo.png> --qualidade high`
- Ex.: `python -I tools/variacoes.py verso polo~vermelho "the plain back of the shirt, collar seen from behind"`

Composições da tabela em inglês, para o argumento:

| Tabela | Inglês |
|---|---|
| em leque, diagonal (canetas) | `N pens fanned out diagonally, tips together, clips aligned` |
| dobradas em escadinha diagonal | `N folded <garments> in a diagonal staircase, each overlapping the next, collars and chest logos visible` |
| em fileira levemente em arco | `N <items> standing in a gentle arc, side by side, not touching` |
| em leque, sobrepostos(as) | `N closed <items> fanned out, overlapping, logos visible` |
| em triângulo (2 atrás, 1 à frente) | `three <items> in a triangle, two behind and one in front` |
| sobrepostos em escadinha, vistos de cima | `N <items> overlapping in a staircase, seen from directly above` |
| 2 fileiras de 4 | `two rows of four, back row slightly higher, slightly overlapping` |

### 3.2 Prompt de grupo
```text
The input images are catalog photos of the SAME product, one per color, all taken in the same studio. Image 1 is the
{color 1} unit; images 2 to {n} are the {color 2}, {color 3}, ... units; the last image is the official TaMa Creative
logo. Create ONE new square 1:1 catalog photo showing exactly {n} units of this product, one in each of these colors
and no other: {color 1} ({hex 1}), {color 2} ({hex 2}), ... Composition: {composition}. All units at the same scale,
none cut off by the frame, the group centered and filling about 65-75% of the frame.
Each unit keeps exactly the shape, proportions, material, stitching, hardware and color of its reference photo, and
its logo exactly as in that photo: same technique, position, relative size and colors. Logo color rule: on white or
light units, coral leaf #D5483A and dark plum wordmark "TaMa" #65253D; on dark or saturated units, {"the official
negative version: coral leaf, cream wordmark, mauve CREATIVE" | "all white"}; on leather, a subtle tone-on-tone blind
deboss. Never grey, flat black, red or blue wordmark, never white on cream. Leaf on the LEFT of the serif wordmark;
spell T-a-M-a and C-R-E-A-T-I-V-E. The logo must be readable on at least the front units.
Seamless flat warm off-white background #FBF8F5 from edge to edge, no gradient, no vignette; the same soft diffused
studio light from the upper left as the references; soft natural contact shadows. No other objects, no props, no
packaging, no text other than the logos, no extra or duplicate units, no watermark. Photorealistic, premium
e-commerce quality.
```
Escolha "negative" para impressos (copos, jogos americanos, sacolas, guarda-chuva) e "all white" para bordado, silk e
laser, como sugerido na AUDITORIA §3, até a decisão pendente ser tomada.

### 3.3 Prompt de verso
```text
The first image is the front catalog photo of a {product, in English} in {color} ({hex}). Create the BACK view of the
very same unit, as if it had been turned 180 degrees on the same spot: same color, material, texture, stitching and
hardware; same camera height, three-quarter angle from slightly above, scale and framing; the same seamless flat warm
off-white background #FBF8F5 from edge to edge, the same soft diffused light from the upper left and soft contact
shadow. Show what the back of this product really looks like: {what to show}. The back is plain: NO logo, no print,
no label, no text. No other objects, no props, no watermark. Photorealistic, premium e-commerce quality.
```
Se o produto real tiver marca atrás, troque a penúltima frase por: `Apply the logo from the second image {placement},
small, following the official color rule (coral leaf and plum wordmark on light surfaces, all white on dark ones,
tone-on-tone deboss on leather).`

## 4. Lista por produto

"(base)" = cor em que o card abre hoje: é a primeira imagem do grupo e a cor do verso. P1 = está na home ou tem 5+
cores; P2 = os demais. Uma linha por `produto` (nome que agrupa o card).

| Produto (prefixo) | Cores com foto | Cores | Grupo: composição sugerida | Verso | Prioridade |
|---|---|---|---|---|---|
| **Vestuário** | | | | | |
| Avental com laço (`avental-laco`) | 7 | Verde-escuro (base), Azul-marinho, Caramelo, Cru, Preto, Rosa, Vermelho | 7 aventais dobrados ao meio em leque, peitoral com logo à mostra | Sim: avesso, alças e laço à mostra, sem logo. Base: `avental-laco~verde-escuro` | P1 |
| Avental personalizado (`avental`) | 7 | Jeans (base), Azul-marinho, Cru, Preto, Rosa, Verde, Vermelho | 7 aventais dobrados ao meio em leque, bolso com logo à mostra | Sim: avesso, alças à mostra, sem logo. Base: `avental~jeans` | P1 |
| Boné (`bone`) | 8 | Verde (base), Azul-marinho, Azul royal, Branco, Cinza, Preto, Rosa, Vermelho | 8 bonés em 2 fileiras de 4 (de trás mais alta), aba para a frente, levemente sobrepostos | Sim: parte de trás, com o regulador, sem logo. Base: `bone~verde` | P1 |
| Camiseta masculina (`camiseta`) | 8 | Branco (base), Azul royal, Azul-marinho, Cinza, Preto, Rosa, Verde, Vermelho | 8 camisetas dobradas em escadinha diagonal, peito com logo à mostra | Sim: costas, sem logo. Base: `camiseta~branco` | P1 (home) |
| Camiseta feminina (`camiseta-feminina`) | 8 | Preto (base), Vermelho, Azul-marinho, Azul royal, Branco, Cinza, Rosa, Verde | 8 camisetas dobradas em escadinha diagonal, peito com logo à mostra | Sim: costas, sem logo. Base: `camiseta-feminina~preto` | P1 (home) |
| Dólmã profissional (`dolma`) | 5 | Branco (base), Azul-marinho, Jeans, Preto, Rosa | 5 dólmãs dobradas em leque, gola e botões à mostra | Sim: costas, sem logo. Base: `dolma~branco` | P1 (home) |
| Moletom personalizado (`moletom`) | 8 | Cinza (base), Preto, Azul-marinho, Azul royal, Branco, Rosa, Verde, Vermelho | 8 moletons dobrados em escadinha diagonal, capuz recolhido, logo à mostra | Sim: costas, capuz, sem logo. Base: `moletom~cinza` | P1 (home) |
| Polo masculina (`polo`) | 8 | Vermelho (base), Azul-marinho, Azul royal, Branco, Cinza, Preto, Rosa, Verde | 8 polos dobradas em escadinha diagonal, gola e logo à mostra | Sim: costas, sem logo. Base: `polo~vermelho` | P1 (home) |
| Polo feminina (`polo-feminina`) | 8 | Azul royal (base), Azul-marinho, Branco, Cinza, Preto, Rosa, Verde, Vermelho | 8 polos dobradas em escadinha diagonal, gola e logo à mostra | Sim: costas, sem logo. Base: `polo-feminina~azul-royal` | P1 (home) |
| **Canetas e escritório** | | | | | |
| Agenda (`agenda-couro`) | 4 | Caramelo (base), Azul-marinho, Café, Preto | 4 agendas fechadas em leque, sobrepostas, fecho à direita | Sim: contracapa, sem logo. Base: `agenda-couro~caramelo` | P1 (home) |
| Caderno de anotações (`caderno`) | 5 | Azul royal (base), Azul-marinho, Preto, Verde, Vermelho | 5 cadernos fechados em leque, elástico à mostra | Sim: contracapa, elástico, sem logo. Base: `caderno~azul-royal` | P1 (home) |
| Caneta bambu (`caneta-bambu`) | 1 | Bambu (base) | —: 1 cor só, sem grupo | Não | P1 (home) |
| Caneta ecológica em kraft (`caneta-kraft`) | 1 | Kraft (base) | —: 1 cor só, sem grupo | Não | P1 (home) |
| Caneta executiva com estojo (`caneta-executiva-estojo`) | 3 | Preto (base), Azul-marinho, Bordô | 3 estojos abertos lado a lado, caneta dentro | Não | P1 (home) |
| Caneta executiva esferográfica (`caneta-executiva`) | 4 | Azul-marinho (base), Preto, Bordô, Prata | 4 canetas em leque, diagonal | Não | P2 |
| Caneta executiva roller (`caneta-roller`) | 4 | Bordô (base), Azul-marinho, Prata, Preto | 4 canetas em leque, diagonal (tampadas) | Não | P1 (home) |
| Caneta metálica com giro (`caneta-giro`) | 4 | Vermelho (base), Azul royal, Prata, Preto | 4 canetas em leque, diagonal | Não | P1 (home) |
| Caneta metálica com ponta touch (`caneta-touch`) | 4 | Preto (base), Azul royal, Prata, Vermelho | 4 canetas em leque, diagonal | Não | P2 |
| Caneta metálica de alumínio (`caneta-metalica`) | 4 | Azul royal (base), Prata, Preto, Vermelho | 4 canetas em leque, diagonal | Não | P1 (home) |
| Caneta plástica básica (`caneta-plastica`) | 4 | Vermelho (base), Azul royal, Branco, Preto | 4 canetas em leque, diagonal | Não | P2 |
| Caneta plástica com grip (`caneta-grip`) | 4 | Azul royal (base), Branco, Preto, Vermelho | 4 canetas em leque, diagonal | Não | P2 |
| Estojo de escritório (`estojo-couro`) | 4 | Caramelo (base), Azul-marinho, Café, Preto | 4 estojos deitados em fileira escalonada | Sim: outra face, sem logo. Base: `estojo-couro~caramelo` | P2 |
| Porta-canetas (`porta-lapis`) | 4 | Azul-marinho (base), Caramelo, Café, Preto | 4 porta-canetas vazios em fileira levemente em arco | Não | P2 |
| **Bolsas e embalagens** | | | | | |
| Caixa personalizada (`caixa-personalizada`) | 4 | Bordô (base), Azul-marinho, Cru, Preto | 4 caixas fechadas, 2 atrás e 2 à frente, tampa com logo visível | Não | P1 (home) |
| Cartão personalizado (`cartao`) | 1 | Creme (base) | —: 1 cor só, sem grupo | Não | P2 |
| Ecobag (`ecobag`) | 4 | Cru (base), Preto, Verde, Vermelho | 4 ecobags em pé em leque, alças para cima | Sim: outro lado, sem logo. Base: `ecobag~cru` | P1 (home) |
| Lacre de cera (`lacre`) | 1 | Dourado (base) | —: 1 cor só, sem grupo | Não | P2 |
| Nécessaire (`necessaire`) | 4 | Terracota (base), Azul-marinho, Caramelo, Preto | 4 nécessaires em fileira escalonada | Sim: outra face, alça, sem logo. Base: `necessaire~terracota` | P2 |
| Sacola personalizada (`sacola-presente`) | 4 | Azul royal (base), Cru, Preto, Vermelho | 4 sacolas em pé em fileira levemente em arco, alças para cima | Sim: outro lado, sem logo. Base: `sacola-presente~azul-royal` | P2 |
| Saquinho de EVA/PVC (`pouch`) | 1 | Transparente (base) | —: 1 cor só, sem grupo | Não | P2 |
| **Garrafas e copos** | | | | | |
| Caneca (`caneca`) | 5 | Branco (base), Azul royal, Preto, Verde, Vermelho | 5 canecas em fileira levemente em arco, alças para a direita | Não | P1 (home) |
| Copo (`copo-termico`) | 5 | Azul royal (base), Branco, Preto, Verde, Vermelho | 5 copos em fileira levemente em arco | Não | P1 |
| Copo com impressão 360° (`copo-acrilico-360`) | 4 | Terracota (base), Azul-marinho, Bordô, Verde-escuro | 4 copos em fileira levemente em arco | Não | P2 |
| Copo de café em inox (`copo-cafe-inox`) | 3 | Inox (base), Branco, Preto | 3 copos em triângulo (2 atrás, 1 à frente) | Não | P2 |
| Copo de papel com tampa (`copo-papel`) | 3 | Preto (base), Branco, Kraft | 3 copos com tampa em triângulo (2 atrás, 1 à frente) | Não | P2 |
| Copo térmico de vinho (`copo-termico-vinho`) | 4 | Azul-marinho (base), Preto, Verde, Vermelho | 4 copos em fileira levemente em arco | Não | P2 |
| Garrafa térmica (`garrafa-termica`) | 5 | Vermelho (base), Azul royal, Branco, Preto, Verde | 5 garrafas em pé em fileira levemente em arco | Não | P1 (home) |
| Squeeze (`squeeze`) | 5 | Azul royal (base), Branco, Preto, Verde, Vermelho | 5 squeezes em pé em fileira levemente em arco | Não | P1 |
| Taça de champagne em acrílico (`taca-champagne-acrilico`) | 4 | Vermelho (base), Azul royal, Branco, Preto | 4 taças em pé em fileira, bojos sem se tocar | Não | P2 |
| Taça de gin em acrílico (`taca-gin-acrilico`) | 4 | Azul royal (base), Vermelho, Branco, Preto | 4 taças em pé em fileira, bojos sem se tocar | Não | P2 |
| Taça de vinho em acrílico (`taca-vinho-acrilico`) | 4 | Bordô (base), Azul royal, Branco, Preto | 4 taças em pé em fileira, bojos sem se tocar | Não | P2 |
| **Acessórios** | | | | | |
| Carteira (`carteira`) | 3 | Preto (base), Café, Caramelo | 3 carteiras fechadas em leque | Não | P2 |
| Chaveiro abridor de garrafa (`chaveiro-abridor`) | 4 | Vermelho (base), Azul royal, Prata, Preto | 4 chaveiros deitados em leque, argolas juntas | Não | P2 |
| Chaveiro de couro (`chaveiro-couro`) | 3 | Caramelo (base), Café, Preto | 3 chaveiros deitados em leque, argolas juntas | Não | P2 |
| Guarda-chuva (`guarda-chuva`) | 4 | Preto (base), Azul-marinho, Verde, Vermelho | 4 guarda-chuvas fechados deitados em diagonal, paralelos | Sim: aberto, visto de outro gomo, sem logo. Base: `guarda-chuva~preto` | P2 |
| **Casa e bem-estar** | | | | | |
| Aromatizador de ambiente (`difusor`) | 2 | Natural (base), Âmbar | 2 frascos lado a lado, varetas abertas | Não | P2 |
| Vela (`vela`) | 3 | Caramelo (base), Café, Preto | 3 velas em triângulo (2 atrás, 1 à frente) | Não | P2 |
| **Hotelaria e gastronomia** | | | | | |
| Cardápio personalizado (`cardapio`) | 6 | Bordô (base), Azul-marinho, Café, Caramelo, Preto, Verde-escuro | 6 cardápios fechados em leque, sobrepostos | Não | P1 |
| Jogo americano impresso (`jogo-americano-impresso`) | 4 | Vermelho (base), Azul-marinho, Preto, Verde-escuro | 4 jogos americanos sobrepostos em escadinha, vistos de cima | Não | P2 |
| Jogo americano oval (`jogo-americano-oval`) | 6 | Taupe (base), Azul-marinho, Bordô, Caramelo, Preto, Verde-escuro | 6 jogos americanos sobrepostos em leque, vistos de cima | Não | P1 |
| Jogo americano retangular (`jogo-americano-retangular`) | 6 | Havana (base), Azul-marinho, Bordô, Caramelo, Preto, Verde-escuro | 6 jogos americanos sobrepostos em escadinha, vistos de cima | Não | P1 |
| Porta-contas personalizado (`porta-contas`) | 6 | Azul-marinho (base), Bordô, Café, Caramelo, Havana, Preto | 6 porta-contas fechados em leque | Não | P1 |

Notas:
- **Verso "Não"**: canetas, copos, taças, garrafas e peças de mesa têm o outro lado igual ou sem interesse. Para
  cardápio, porta-contas e caixa, uma foto de **detalhe** (aberto) vale mais que o verso.
- `copo-acrilico-360` e `caneta-giro`/`caneta-executiva` têm decisões pendentes na AUDITORIA §4 (P2): resolva antes
  do grupo.
- A cor-base muda se a home ou as fotos mudarem. O verso precisa ter o nome da cor em que o card abre; senão, aparece
  só na galeria.

## 5. Custo e esforço

| | P1 | P2 | Total |
|---|---|---|---|
| Grupo (produtos com 2+ cores) | 25 | 22 | **47** |
| Verso (só a cor-base, onde faz sentido) | 12 | 4 | **16** |
| **Imagens a gerar** | 37 | 26 | **63** |

- Conte 1 a 3 tentativas por imagem (grupos de 7–8 peças erram mais: peça faltando, cor repetida, logo torto). Na
  prática, ~100–150 chamadas para o lote inteiro. Confira o preço do modelo antes; cada imagem de entrada também é
  cobrada, e um grupo de 8 cores manda 9 imagens por chamada. Use `--qualidade high` nos grupos.
- Comece pelo P1 de vestuário (8 cores, maior ganho no card) e pelos versos de vestuário.
- **Aceite de cada imagem:**
  1. `python -I tools/auditar_imagens.py` (fundo #FBF8F5 e enquadramento). Nas fotos de grupo, o aviso de "cor longe
     da declarada" é esperado (são várias cores); confira na folha de contato em `midia/produtos/auditoria/`.
  2. Revisão visual ampliada: número de peças = número de cores, cada cor certa e uma só vez, grafia e cor do logo
     (§2), nenhum objeto extra; no verso, mesma cor da frente e sem logo.
  3. Só então mude `aprovacao` para `aprovada` (no /admin/: Situação da foto → Aprovada). Até lá fica `revisao`.
