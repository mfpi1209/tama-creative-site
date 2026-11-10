# Fotos da galeria de coleções: marca TaMa, uma cor por categoria

São 9 fotos ambientadas para as faixas da galeria da home, uma por categoria. Todas levam a **assinatura nova da TaMa**
(pétala coral + "TaMa" + CREATIVE) aplicada na peça e cada categoria vem numa **cor diferente**. Elas substituem as
capas do blog, que hoje misturam marcas fictícias (Nexo, Elo, Vera, Oliva).


> **Atualização de 10/11/2026:** as 9 fotos já estão no site (`img/galeria/*.webp`), geradas pela API com
> `python -I tools/galeria_fotos.py` (prompts e cores no próprio script). A direção mudou a pedido do cliente: em vez
> de fundos neutros frios (a galeria ficava toda cinza/esverdeada), **cada categoria tem uma cor de peça diferente**
> (cobalto, bordô, laranja, cru com verde, mostarda, madeira com rosé, caramelo, rosa-blush, marinho) sobre fundos claros
> variados, com a assinatura pétala. Para refazer uma: `python -I tools/galeria_fotos.py <categoria>` e converta para
> WebP. O roteiro abaixo (ChatGPT, manual) fica como alternativa.

## Como fazer (no ChatGPT)

1. Abra uma conversa nova no ChatGPT e anexe os logos da pasta `logos` (arraste do Finder para a caixa de mensagem):
   - `lockup-positivo.png`: para peças claras;
   - `lockup-branco.png`: para peças escuras;
   - `lockup-grafite.png`: para gravação em uma cor (metal, madeira, couro).
2. Cole primeiro o bloco **Direção comum** e depois o prompt da primeira foto. Peça as outras na mesma conversa, uma por
   vez, para manter a luz e o estilo iguais.
3. Confira o logotipo de cada foto (ver **Checagem**). Se as letras saírem erradas, peça: "refaça mantendo tudo igual,
   só corrija o logotipo para ficar idêntico ao anexo".
4. Salve cada foto com o nome indicado (ex.: `garrafas-copos.png`) dentro da pasta `prontas` e me avise. Eu coloco no
   site (`img/galeria/`). O build já usa essas fotos no lugar das capas do blog, sem outra mudança.

## Direção comum (cole antes de cada prompt)

> Fotografia de produto ambientada, realista, para o site de uma empresa de brindes corporativos. Formato horizontal
> 3:2 (1536 × 1024). A peça fica no **terço central** da imagem, inteira, com bastante respiro dos dois lados (a foto
> será recortada em faixas verticais estreitas e também aparecerá larga). Luz natural suave vindo da esquerda, sombras
> macias. Superfície e fundo em **tons neutros frios**: pedra clara acinzentada, linho cinza-claro, concreto polido
> claro ou parede gelo (#F4F6F8). **Nada de creme, bege ou dourado dominante.** No máximo um elemento de apoio discreto
> (um ramo verde, um livro cinza, um copo de vidro). Sem pessoas, sem texto além do logotipo, sem outras marcas.
> **Logotipo:** aplique exatamente o logotipo anexado (pétala coral à esquerda, "Ta" em grafite e "Ma" em bordô, a
> palavra CREATIVE espaçada embaixo), sem redesenhar as letras, pequeno e proporcional à peça, com a técnica indicada.
> Visual premium, limpo e contemporâneo, profundidade de campo rasa, nitidez alta no logotipo.

## As 9 fotos

| # | Arquivo | Categoria | Peça e cor | Técnica do logotipo |
|---|---|---|---|---|
| 1 | `garrafas-copos.png` | Garrafas e copos | Copo térmico com tampa, **azul royal** fosco, e um copo de vidro ao fundo | Gravação a laser (logotipo em metal claro) |
| 2 | `vestuario.png` | Vestuário | Moletom com capuz **verde floresta** dobrado, boné cinza-claro ao lado | Bordado em branco, com a pétala em coral |
| 3 | `canetas-escritorio.png` | Canetas e escritório | Caderno capa dura **laranja queimado** com elástico e caneta metálica grafite por cima | Baixo-relevo (hot stamping) em tom sobre tom |
| 4 | `bolsas-embalagens.png` | Bolsas e embalagens | Ecobag de lona **cru** com alças **bordô**, em pé, levemente aberta | Silk em grafite e bordô (logotipo positivo) |
| 5 | `tecnologia.png` | Tecnologia | Power bank e carregador sem fio **vermelho** fosco, com cabo enrolado | Silk branco |
| 6 | `cozinha-bar.png` | Cozinha e bar | Tábua de queijos em **madeira clara** com facas de cabo de madeira e duas taças | Gravação a laser em uma cor |
| 7 | `acessorios.png` | Acessórios | Necessaire e carteira em couro sintético **caramelo** | Baixo-relevo sem cor |
| 8 | `casa-bem-estar.png` | Casa e bem-estar | Difusor de aromas em vidro **âmbar** com varetas e uma manta cinza dobrada | Etiqueta branca com o logotipo positivo |
| 9 | `hotelaria-gastronomia.png` | Hotelaria e gastronomia | Porta-contas e cardápio em couro sintético **azul-marinho** sobre mesa posta cinza | Hot stamping prateado |

### Prompts prontos

1. **Garrafas e copos**: "Um copo térmico com tampa, azul royal fosco, sobre pedra clara acinzentada, com um copo de
   vidro transparente desfocado ao fundo. Logotipo gravado a laser no corpo do copo, de frente para a câmera."
2. **Vestuário**: "Um moletom com capuz verde floresta, dobrado com cuidado sobre um banco de concreto claro, e um boné
   cinza-claro ao lado. Logotipo bordado em branco no peito do moletom, com a pétala bordada em coral."
3. **Canetas e escritório**: "Um caderno de capa dura laranja queimado, com elástico, sobre mesa de pedra clara, e uma
   caneta metálica grafite apoiada em diagonal. Logotipo em baixo-relevo, tom sobre tom, no centro da capa."
4. **Bolsas e embalagens**: "Uma ecobag de lona cru com alças bordô, em pé e levemente aberta, sobre piso de concreto
   claro, com um ramo verde discreto dentro. Logotipo positivo em silk (grafite e bordô, pétala coral) na frente."
5. **Tecnologia**: "Um power bank e um carregador sem fio, ambos vermelhos foscos, sobre linho cinza-claro, com um cabo
   enrolado ao lado. Logotipo em silk branco no power bank."
6. **Cozinha e bar**: "Uma tábua de queijos em madeira clara com duas facas de cabo de madeira e duas taças de vinho
   vazias ao fundo, sobre bancada de pedra cinza-clara. Logotipo gravado a laser em uma cor no canto da tábua."
7. **Acessórios**: "Uma necessaire e uma carteira em couro sintético caramelo, lado a lado, sobre linho cinza-claro.
   Logotipo em baixo-relevo, sem cor, na necessaire."
8. **Casa e bem-estar**: "Um difusor de aromas em vidro âmbar com varetas de madeira, ao lado de uma manta de tricô
   cinza dobrada, sobre aparador claro. Etiqueta branca no vidro com o logotipo positivo."
9. **Hotelaria e gastronomia**: "Um porta-contas e um cardápio em couro sintético azul-marinho sobre mesa posta com
   toalha cinza-clara, prato branco e talheres. Logotipo em hot stamping prateado na capa do cardápio."

## Checagem antes de salvar

- O logotipo está **idêntico ao anexo**: pétala coral à esquerda, "TaMa" sem letras trocadas, CREATIVE embaixo.
- **Uma marca só**: nenhuma outra marca, texto ou etiqueta inventada na foto.
- A peça está **inteira no terço central**, sem encostar nas bordas.
- O fundo está **neutro e frio** (pedra, linho cinza, gelo), sem creme ou bege dominante.
- A **cor da peça** é a da tabela (cada categoria numa cor).
- A foto não mostra material, capacidade ou acabamento que a TaMa não ofereça para aquela peça. Na dúvida, confira com
  o catálogo.
