# Mockups com a marca — briefing "Sua marca. Nossa criatividade."

Status: **aprovado e publicado em produção em 12/10/2026**.

No site:
- as 27 imagens;
- o bloco "Sua marca é a protagonista", com o caderno TaMa × Casa Mirelo, na home e na curadoria;
- o selo "Personalizável com sua marca" e "Exemplo com marca fictícia" nos cards;
- os avisos novos e a legenda "Mockup ilustrativo".

Ainda só como sugestão (seção 4.3/4.4):
- o CTA "Personalize com sua marca";
- a assinatura conceitual na abertura e no rodapé;
- a faixa de comparação na página de branding.

## 1. O que foi produzido

27 imagens em `midia/mockups/` (ver `midia/mockups/manifest.json`):

| Grupo | Quantidade | Arquivos |
|---|---|---|
| Campanhas (aberturas) | 3 | `hero-gift-tama`, `hero-wear-tama`, `hero-brand-tama` (com recorte 4:5 para celular) |
| Curadoria de produtos | 22 | um por peça da vitrine, mais a vista frontal da ecobag |
| Demonstração com marca fictícia | 2 de comparação + 2 na vitrine | `caderno-azul-ficticia-casa-mirelo`, `totebag-ficticia-ondora` (mesma foto, mesmo ângulo e luz da versão TaMa); `caneca-ceramica-ficticia-casa-mirelo`, `uniforme-verde-ficticia-ondora` |

Proporção: 23 imagens com a identidade TaMa e 4 com marcas fictícias (≈ 85/15). Para chegar perto dos 80/20 do briefing, a próxima rodada pode trocar mais 1 ou 2 peças da vitrine por uma marca fictícia.

Cada imagem tem:
- **mestre** em `mestre/` (JPEG 95, 4:4:4): produtos com 2550 × 2340 px, aberturas com 3200 px de largura;
- **web** em `web/` (WebP e AVIF): produtos com 1600 px, aberturas com 2400 px, mais o recorte para celular com 1080 × 1350;
- **miniatura** com 480 px;
- **texto alternativo** em português, no manifesto.

Nomenclatura: `<foto>-tama` ou `<foto>-ficticia-<marca>`.

## 2. Sistema de aplicação adotado

| Nível | Uso | Onde foi aplicado |
|---|---|---|
| 1 — Assinatura completa (pétala + TaMa Creative) | Embalagens, sacolas, cadernos, caixas, cartões, peça central do kit | Caixa rígida, tampa do kit, sacola, cadernos, garrafa, moletom, ecobag, cartões, faixa da manta |
| 2 — Pétala isolada | Detalhes e espaços pequenos | Cartão bordô, bandejas de couro, boné, polo, caneta, alça do kit, garrafa pequena, selo do envelope |
| 3 — Elemento gráfico | Relevos, padrões | Não usado nesta rodada (o relevo em arco que já existe na prancha creme foi mantido) |

Técnica por material:
- couro: baixo-relevo, ou hot stamping no couro escuro;
- metal: laser;
- tecido: bordado ou silk;
- papel e embalagem: hot stamping dourado, impressão e relevo seco;
- cerâmica: decalque.

As cores dos produtos foram mantidas (azul-marinho, terracota, oliva, mostarda, bordô, verde, azul royal, off-white).

Objetos que aparecem em várias fotos recebem a mesma aplicação em todas, porque várias imagens são recortes da mesma cena. O posicionamento foi medido entre os recortes.

## 3. Como as imagens foram feitas (para quem for usar)

- A base são as fotos conceituais da v2, geradas por IA em 850 px (aberturas em 1600 px).
- Ampliação: Real-ESRGAN x4plus, rodado localmente, com restauração da textura de papel, tecido e pedra.
- O logo é sempre o vetor oficial (`tama-creative-logos/svg/`), aplicado com perspectiva, curvatura (garrafas e caneca), luz da cena e textura do material. Nunca foi redesenhado nem gerado por IA.
- Também foram removidas as falsas marcas e os textos ilegíveis que a IA tinha deixado (tampa da caixa, cartões, bandejas).
- **Limite:** os detalhes finos são reconstruídos pela ampliação, não fotografados. As imagens servem para o site e para apresentações digitais. Para impressão em grande formato, gerar ou fotografar a cena já em alta resolução.

## 4. Textos sugeridos para o site (não implementados)

### 4.1 Explicação antes da curadoria
Na home, antes da vitrine, e no topo de `/brindes-corporativos-premium/`:

> **Sua marca é a protagonista.**
> Os produtos exibidos são exemplos de personalização com a identidade TaMa Creative. No seu projeto, a marca, as cores e os elementos visuais da sua empresa assumem esse lugar.

### 4.2 Selo nos cards de produto
- Selo discreto em todos os cards: **"Personalizável com sua marca"**. Hoje o selo é "Seleção TaMa", que poderia ficar só nas peças em destaque.
- Texto alternativo das imagens: terminar em "Mockup ilustrativo." ou, nas marcas fictícias, "Mockup ilustrativo com marca fictícia." (já está no manifesto).
- Na foto ampliada (lightbox), legenda curta: "Mockup ilustrativo · personalizável com a sua marca".

### 4.3 Comparação visual
Nova faixa, por exemplo na página de branding e na curadoria, com duas fotos lado a lado (caderno TaMa × caderno Casa Mirelo; ecobag TaMa × ecobag Ondora):

> **Uma ideia. Infinitas possibilidades de identidade.**
> À esquerda, a identidade TaMa Creative; à direita, uma marca fictícia criada para este exemplo.

### 4.4 Conceito e chamadas
- Assinatura conceitual: **"Sua marca. Nossa criatividade."**, na abertura da home e no rodapé.
- CTA principal: **"Personalize com sua marca"**, levando para `/solicitar-proposta/`.
- CTAs secundários, conforme o contexto:
  - "Solicitar proposta" no formulário;
  - "Explorar a curadoria" na vitrine;
  - "Criar meu kit" nos kits, com `?tipo=kits`;
  - "Conhecer as possibilidades" em branding e confecções.

### 4.5 Avisos atuais que mudam
Os avisos atuais (home e curadoria) dizem:

> "Fotografias de produtos são conceituais e ilustram possibilidades; não representam estoque nem trabalhos para clientes."

Sugestão de troca:

> "Os produtos exibidos usam a identidade TaMa Creative como exemplo de personalização. No seu projeto, a marca, as cores e os elementos visuais da sua empresa assumem esse lugar. Imagens ilustrativas; materiais e técnicas são confirmados na proposta."

## 5. Decisão que muda com o briefing

Na evolução anterior (ver `RELATORIO.md`), a regra era **mostrar mockups com o logo TaMa só no caso real e em `/projetos/`**. O objetivo era não sugerir que a TaMa vende produtos com a própria marca. O briefing inverte isso: o logo TaMa vira o exemplo de personalização em todo o site, e os textos da seção 4 passam a fazer a ressalva. Por isso imagens e textos devem entrar **juntos**.

## 6. Pendências do briefing

- **Três imagens por produto** (principal, detalhe e contexto): hoje há uma por produto. As imagens de detalhe (textura e acabamento) e de contexto (em uso) precisam de nova geração ou fotografia.
- **Coleções por ocasião**: as seis coleções usam as fotos atuais. Composições específicas para onboarding, eventos, executivos, campanhas, reconhecimento e datas comemorativas são a próxima leva.
- **Mais marcas fictícias** para chegar aos ~20%, com estilos variados (por exemplo, uma marca de tecnologia e uma de saúde).
- **Viabilidade técnica**: confirmar com fornecedores cada técnica mostrada antes de ofertar (o briefing pede isso).

## 7. Como atualizar as imagens

1. Gere ou ajuste o mockup e exporte para `midia/mockups/` (mestre, web, miniatura e `manifest.json`).
2. Rode `python tools/sync_mockups.py`. Ele copia as versões web para `img/marca/` e grava os textos alternativos em `src/data/mockups.json`.
3. Rode `python build.py`. O build usa as imagens de `img/marca/` no lugar das fotos de mesmo nome em `img/v2/` porque `site.config.json` tem `"mockups_marca": true`.
4. Para voltar às fotos sem marca, use `"mockups_marca": false` (ou a variável `MOCKUPS_MARCA=0`) e gere de novo.

## 8. Segunda rodada (13/10/2026): mais destaque e foto por cor

A pedido do usuário ("imagens sem a marca ou só com a pétala"), a regra de equilíbrio do briefing foi relaxada.

- **Marca visível em todo card:** toda peça tem a assinatura completa legível num card de ~300 px.
  - Bandejas: hot stamping dourado na lateral.
  - Boné e polo: assinatura bordada.
  - Envelopes: hot stamping.
  - Tampas e faixas: maiores.
- **Foto por cor:** cada uma das 21 peças tem a foto nas 3 cores alternativas do card, ou seja, 63 variantes geradas por recoloração do produto, preservando luz, textura e marca.
  - No site, clicar na cor troca a foto no card, na foto ampliada e na gaveta da seleção.
  - Os arquivos ficam em `img/marca/<foto>~<cor>.webp` e em `midia/mockups/web/`.
- **Listas de cores ajustadas** para começar pela cor fotografada: kit de papelaria (Terracota), organizador (Verde-escuro), uniforme (Verde-oliva) e garrafa (tom do Verde-musgo).
- **Cache:** os nomes públicos das imagens agora levam um código do conteúdo (`/img/<nome>.<hash>-<largura>.<ext>`). Uma imagem atualizada ganha uma URL nova, mesmo com o cache de 1 ano.

