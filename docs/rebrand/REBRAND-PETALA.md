# Identidade "pétala": TaMa Creative

Esta é a identidade aplicada ao site na branch `redesign/rebrand-petala`, em 08/11/2026. Ela parte das pranchas que o
cliente trouxe (geradas no ChatGPT), com um ajuste pedido depois: a base marfim e bege das pranchas foi trocada por um
neutro frio, branco e gelo. A pétala, o bordô e a Sora continuam como nas pranchas.

Este documento substitui as três direções de [`REBRAND.md`](REBRAND.md), que fica como histórico da proposta anterior.

---

## 1. Conceito

**"Tradição e modernidade em movimento."** A pétala vem do arco do logotipo original. Ela liga a marca à sua trajetória e
ganha uma forma mais orgânica, com cara de gesto. A tipografia é geométrica e limpa. A base neutra e fria deixa o produto
e a marca do cliente em primeiro plano.

O que a marca precisa dizer: a TaMa **seleciona, personaliza e coordena**. Na peça, quem aparece é a marca do cliente. A
identidade da TaMa tem de ser reconhecível sem competir com ela.

---

## 2. Assinatura

A assinatura é a pétala coral, seguida de **"TaMa"** em Sora 700, com o "Ta" em grafite e o "Ma" em bordô, sem ponto
final. Embaixo vem **CREATIVE**, espaçado.

| Versão | Uso | Arquivo (`brand/petala/`) |
|---|---|---|
| Positiva | Fundo claro (site, documentos, proposta) | `lockup-positivo.svg` · `.png` (3000 px) |
| Negativa | Fundo escuro (rodapé, cartão, slides escuros) | `lockup-negativo.svg` · `.png` |
| Grafite (uma cor) | Gravação, carimbo, P&B | `lockup-grafite.svg` · `.png` |
| Branca (uma cor) | Sobre foto ou cor chapada | `lockup-branco.svg` · `.png` |
| Símbolo (pétala) | Favicon, avatar, selo, detalhe gráfico | `simbolo-coral` · `-bordo` · `-grafite` · `-branco` (`.svg` · `.png`) |
| Avatar e favicon | Redes, ícone do site | `avatar-512.svg` · `.png`, `favicon-64.svg` · `.png` |

Os SVGs têm o texto convertido em contorno, então abrem sem a fonte instalada. Os PNGs têm fundo transparente.

**Regras de uso**
- A área de proteção ao redor da assinatura tem a altura do "T" de "TaMa", em todos os lados.
- Tamanho mínimo: 96 px de largura na tela e 25 mm na impressão. Abaixo disso, use só o símbolo.
- Não troque as cores da pétala por outras fora da paleta, não gire, não distorça e não aplique sombra ou contorno.
- Sobre foto, use a versão branca numa área calma da imagem.

---

## 3. Símbolo: a pétala

Forma: um segmento de folha na diagonal, mais cheio embaixo e à esquerda. O path é
`M6 4C8 52 44 92 96 96C70 66 40 30 6 4Z`, numa caixa de 100 × 100 (`build.py › PETALA`).

Usos:
- ao lado do nome, na assinatura;
- sozinho, no favicon, no avatar e no selo da embalagem;
- como **forma orgânica de apoio**: pétalas grandes em blush ou oliva claro no fechamento das páginas e em máscaras
  (`--petala` no CSS);
- como gesto de interação: a pétala aparece no canto ou atrás do item em foco (protótipos da galeria).

**Coral só na pétala.** O coral nunca é usado em texto nem em botões.

---

## 4. Paleta

| Cor | Hex | Uso | Contraste |
|---|---|---|---|
| Branco | `#FFFFFF` | fundo principal | — |
| Gelo | `#F4F6F8` | faixas e superfícies alternadas | — |
| Gelo escuro | `#EBEEF2` | superfícies, fundos de foto | — |
| Linha | `#E1E5EA` · `#C9CFD6` | divisórias, contorno de cards e botões | — |
| Grafite | `#1F2328` | texto, faixas escuras, rodapé | 15,8:1 sobre branco |
| Texto de apoio | `#59616C` | descrições, legendas | 6,3:1 sobre branco · 5,8:1 sobre gelo |
| Bordô TaMa | `#6B1F3B` (hover `#561830`) | "Ma", botões principais, links, destaques de título | 11,1:1 sobre branco |
| Blush | `#F4E6EA` | chips, fundos de destaque pequenos | — |
| Bordô claro | `#E8A9BB` | bordô sobre fundo escuro | 8,1:1 sobre grafite |
| Coral | `#E14B3B` | só a pétala e detalhes gráficos | não é cor de texto |
| Verde oliva | `#2F4F3E` · `#E4E9E0` | chips e apoio pontual | 9,1:1 sobre branco |

**Proporção:** cerca de 80% de branco e gelo, 15% de grafite e o restante em bordô. O coral aparece só na pétala. O
calor vem das **cores dos produtos** e das fotos, não do fundo.

**Testado e trocado:** o marfim `#FBF8F3` e o bege quente `#EDE3D6` das pranchas foram aplicados e depois substituídos
pelo gelo, a pedido do cliente ("o tom pastel voltou a ser protagonista; a versão mais moderna era um neutro, com gelo").

---

## 5. Tipografia

| Papel | Fonte | Peso | Detalhe |
|---|---|---|---|
| Títulos | Sora | 600–700 | tracking −0,035 em; a última parte em bordô ("Cinco frentes, *uma linguagem.*") |
| Texto e interface | Sora | 400–600 | 15–17 px, entrelinha 1,6 |
| Rótulos (eyebrow) | Sora | 600 | caixa alta, espaçamento 0,16–0,22 em, com traço bordô de 28 px antes |
| Palavras da abertura | Sora Contorno | 800 | só contorno, com véu claro, na frente da peça (PRESENÇA., EQUIPE.) |

- A Sora é variável e tem licença livre (OFL). Os arquivos estão em `src/fonts/sora-latin*.woff2`.
- A **Sora Contorno** (`src/fonts/sora-contorno-800.woff2`, 3 KB) tem só as maiúsculas e os contornos sobrepostos
  removidos. Sem ela, o contorno das letras mostraria traços internos. Ela é gerada por `tools/fonte_contorno.py`.
- Fallback: "Sora Fallback" (Arial com métricas ajustadas), para a página não pular enquanto a fonte carrega.

---

## 6. Elementos e componentes

- **Rótulo:** traço bordô de 28 × 1,5 px seguido do texto em caixa alta espaçada.
- **Botões:**
  - pílula bordô (ação principal);
  - pílula com contorno (secundária);
  - link bordô com seta que desliza 4 px;
  - botão redondo com seta (carrossel; o "próximo" é preenchido de bordô).
- **Chips:** blush (novidade), oliva claro (personalizável) e contorno bordô (lançamento). O chip ativo fica bordô.
- **Abas:** texto com ícone de linha e sublinhado bordô de 2 px na aba ativa.
- **Cards de foto:**
  - número, título, subtítulo e seta num círculo branco, que fica bordô no hover;
  - a foto aproxima 3 a 4% no hover.
- **Ícones:** de linha, traço 1,2–1,4, cantos arredondados, em bordô ou grafite. Nunca emoji.
- **Formas orgânicas:**
  - curva bordô no canto superior direito da abertura (some abaixo de 760 px);
  - pétalas grandes e claras no fechamento.
- **Divisórias:** fio de 1 px em `#E1E5EA`. A versão tracejada é só para apoio.

---

## 7. Movimento

- A curva de movimento é `cubic-bezier(.22, 1, .36, 1)`. Entradas de 560 ms e microinterações de 150 a 320 ms.
- **Um gesto por interação:** a faixa da galeria abre, o card aproxima, a seta desliza. Nada fica em loop disputando
  atenção, só a flutuação suave da peça ativa na abertura.
- A opção "reduzir movimento" do sistema é respeitada em todos os componentes.

---

## 8. Fotografia

- **Uma marca só nos produtos:** a TaMa, com a assinatura nova. Em fotos de exemplo, nada de marcas fictícias
  misturadas (Nexo, Elo, Vera, Oliva) nem marcas de terceiros.
- **Variedade de cor nas peças:** cada categoria numa cor diferente (azul royal, verde, bordô, laranja, marinho,
  natural), para trazer calor sem pintar o fundo.
- **Luz natural lateral** sobre superfícies claras e frias: pedra clara, linho cinza, madeira clara e gelo. Sem creme ou
  bege dominante.
- **Recorte** (fundo removido, sombra de chão) para a abertura e os cards de produto. **Ambientada** para galeria,
  frentes e kits.
- Toda foto de exemplo leva a nota "marca TaMa como exemplo" quando puder ser confundida com um trabalho entregue.

---

## 9. Aplicações

| Ponto | Estado |
|---|---|
| Site: cabeçalho, rodapé, favicon, ícones, imagem de compartilhamento | Aplicado (branch `redesign/rebrand-petala`) |
| Fotos de produto (recortes da abertura) | Ainda com o logotipo anterior; refazer com a assinatura nova |
| Fotos da galeria de coleções | Em produção (pacote de prompts, com a assinatura nova e uma cor por categoria) |
| Assinatura de e-mail, proposta em PDF, cartão, caixa, etiqueta, redes | A fazer |

---

## 10. Arquivos e como gerar de novo

| O quê | Onde |
|---|---|
| Logos, símbolo, favicon e avatar | `brand/petala/` |
| Tokens (cores, fontes, raios, movimento) | `src/v3.css › :root` |
| Fontes | `src/fonts/` (Sora e Sora Contorno) |
| Pranchas de referência do cliente | fora do repositório (imagens do ChatGPT de 08/11/2026) |

```bash
pip install fonttools brotli skia-pathops
python tools/marca_assets.py petala    # brand/petala/
python tools/fonte_contorno.py         # src/fonts/sora-contorno-800.woff2
```

Os arquivos são de aplicação digital. Para impressão e gravação, o ideal é um ajuste fino da assinatura (kerning e
espaçamento ótico) por um designer de marcas, com as cores convertidas em Pantone e CMYK.
