# Estudo: apresentação do catálogo (busca, filtro lateral e fotos maiores)

**Data:** 18/10/2026. **Referência:** creativedesign.com.br/office?filters=canetas. **Protótipo:** /catalogo/ na branch
`qa-final` (sem push).

## 1. O que a referência faz

| Ponto | Creative Design (Office) |
|---|---|
| Layout no desktop | Barra lateral fixa de 320 px à esquerda; grade de 3 colunas à direita |
| Busca | "Buscar em Office", no topo da barra lateral (e uma busca geral no cabeçalho) |
| Filtros | Tipo de produto (Agendas, Canetas…), especificações (Com pauta, Ecológicos…) e cores (bolinha + nome), em listas recolhíveis; filtros ativos aparecem como etiquetas acima da grade |
| Card | Foto quadrada de 300 px com o produto inteiro (`contain`), bolinhas de cor + "4 cores", nome, código, "Detalhes" e "+" (orçamento) |
| Celular | 1 card por linha, foto de 300 px; os filtros abrem numa gaveta lateral pelo ícone de funil no cabeçalho |
| Outros | Ordenação, total de produtos, filtro na URL (`?filters=canetas`) |

## 2. Como estava o nosso /catalogo/

| Medida | 1440 px | 1024 px | 390 px (celular) |
|---|---|---|---|
| Colunas | 4 | 3 | 2 |
| Foto do card | 278 px | 300 px | **172 px** |
| Filtros | 8 pílulas de categoria acima da grade | Mesmo | Pílulas em 4 linhas: **192 px** antes do primeiro produto |
| Busca | Não tinha | Não tinha | Não tinha |
| Filtro por cor | Não tinha | Não tinha | Não tinha |

## 3. O que o protótipo faz

| | Desktop (≥ 1200 px) | Tablet (600–1199 px) | Celular (< 600 px) |
|---|---|---|---|
| Busca | Campo largo acima da grade; procura em nome, modelo e cores, sem acento | Fixa no topo ao rolar, com o botão "Filtros" | Igual ao tablet |
| Filtros | Barra lateral fixa (240 px): **Categoria** (com o total de cada uma) e **Cor** em 8 famílias (Preto, Branco e claros, Cinza e metálicos, Azul, Vermelho e bordô, Verde, Rosa, Marrons e naturais) | Gaveta lateral com "Ver N modelos" e o número de filtros ativos no botão | Igual ao tablet |
| Grade | 3 colunas num contêiner de até 1440 px: **foto de 333 px** (+20%) | 3 colunas até 900 px, depois 2: foto de 298 px (1024 px) | **1 por linha: foto de 356 px (+107%)**, com opção de 2 por linha (lembrada no navegador) |
| Card | O mesmo de antes, sem a linha "Material e técnica sob consulta" (vale para todos e foi para a nota abaixo da grade) | | |

**Outros comportamentos:**
- **Cor escolhida:** com filtro de cor, cada card já mostra a peça numa cor da família escolhida.
- **Estado na URL:** `?q=caneca&categoria=garrafas-copos&cor=azul,verde`, para compartilhar. O link antigo
  `?categoria=vestuario` continua funcionando.
- **Sem resultado:** mensagem com "Limpar filtros" e chamada "Pedir uma peça que não está aqui".
- **Acessibilidade:**
  - campo com rótulo;
  - filtros em grupos com legenda;
  - total anunciado ao leitor de tela;
  - a gaveta abre com o foco dentro e fecha com Esc, devolvendo o foco ao botão.

**Verificado:**
- 133 testes e2e (10 novos para busca, filtros, URL e gaveta);
- axe-core sem violações;
- sem vazamento horizontal de 320 a 1440 px;
- Lighthouse móvel do /catalogo/: desempenho 98; SEO, acessibilidade e boas práticas 100.

## 4. Pontos para decidir

1. **Decidido em 18/10/2026: mantém 1 foto por linha no celular.** **Altura da página no celular:** com 1 foto por linha, o /catalogo/ passa de 14.400 para 32.100 px (52 cards). A busca
   e o botão de filtros ficam fixos no topo, o que ajuda. Se parecer longo demais, há duas saídas:
   - começar em 2 por linha (o visitante pode trocar);
   - mostrar 12 modelos e um botão "Ver mais".
2. **Largura:** no desktop, o catálogo ocupa até 1440 px, mais largo que o cabeçalho (1280 px), para as fotos crescerem
   sem perder a barra lateral. A alternativa é manter 1280 px com fotos de ~295 px.
3. **Ordem dos modelos:** hoje é por categoria e nome; Avental abre o catálogo. A referência tem "Ordenar por". Sugestão:
   a TaMa define os destaques de cada categoria (polos e camisetas primeiro) e o site ordena por eles. Um campo "ordem"
   no /admin/ resolve.
4. **Filtros futuros:** quando material e técnica forem confirmados no /admin/, entram como filtros ("Bordado",
   "Gravação a laser", "Couro"…), como as "Especificações" da referência. Antes disso, filtrar por eles prometeria o que
   não está confirmado.
5. **Levar o mesmo padrão para a curadoria** (/brindes-corporativos-premium/), que ainda usa pílulas de categoria e
   ocasião. Ela tem outro card (sessão curadoria-cores); vale unificar quando a curadoria virar "seleções por ocasião"
   dentro do catálogo, como sugere a auditoria geral (P1-4).
6. **Código do produto (SKU) no card**, como na referência: só quando houver SKU real (o campo existe no banco, vazio).

## 5. Páginas de produto, foto por cor e zoom (segunda rodada)

**Como a referência faz** (navegado em 18/10/2026):
- **Página:** uma por produto (`/canetas/caneta-plastica-cac1465`). A cor entra como parâmetro na mesma página
  (`?color=preto`), muda o título ("… - Preto") e o código (CAC1465 → CAC1465PT). O canonical aponta para a página sem
  a cor. Não há uma página por cor.
- **Na listagem:** o card abre numa foto com todas as cores juntas; ao escolher a cor, aparece só aquela peça, com a
  marca, e surge "Adicionar ao orçamento".
- **Na página do produto:** galeria com miniaturas (grupo + cada cor), descrição, características (medidas, peso) e
  "Adicionar ao orçamento".
- **Ao passar o mouse:** alguns produtos mostram uma segunda foto, como frente e verso da nécessaire.

**O que o protótipo faz:**
- **Uma página por modelo:** `/catalogo/<nome>/`, 52 páginas, todas no sitemap. Cada uma tem:
  - galeria com uma miniatura por cor;
  - bolinhas de cor;
  - cor na URL (`?cor=verde`), com canonical sem a cor;
  - zoom 2x que segue o mouse (no celular, o "+" abre a foto ampliada);
  - Material, Personalização, Quantidade e prazo ("sob consulta" até confirmar no /admin/);
  - "Adicionar à seleção", "Solicitar proposta" e WhatsApp;
  - texto da categoria;
  - 4 modelos relacionados.
- **Cards** (catálogo, home e páginas de frente): a foto e o nome levam à página do modelo; o "+" continua abrindo a
  foto ampliada.
- **Fotos de grupo e verso:** o banco aceita o campo **Vista** (frente, grupo, verso, detalhe), também no /admin/.
  - Com foto de **grupo**, o card abre nela, com "N cores", e ela vira a primeira miniatura.
  - Com foto de **verso**, ela aparece ao passar o mouse no card e na galeria.
  - Ainda não há nenhuma dessas fotos no banco. Os prompts para gerá-las estão em `docs/PROMPTS-GRUPO-VERSO.md`.
- **Medições:** Lighthouse móvel nas páginas de produto com desempenho 98–99 e SEO, acessibilidade e boas práticas 100;
  139 testes e2e.

**Revisão em paralelo (3 agentes, 18/10/2026):**
- **QA visual das 52 páginas** (104 cargas): sem erro e sem vazamento. Ajustes feitos:
  - miniaturas numa linha no desktop;
  - faixa até a borda, com esmaecido, no celular;
  - "+" no canto de baixo, para não cobrir as canetas;
  - ficha técnica mais estreita no celular.
- **SEO e texto:**
  - título "<nome> personalizado(a) | TaMa Creative", sem "com … com" e com até 60 caracteres;
  - descrição por uso da categoria;
  - textos de categoria e da ficha revisados;
  - relacionados em rodízio (antes, 23 páginas não recebiam nenhum link de outra página de produto).
- **Nomes que afirmavam material**, renomeados:
  - "Chaveiro de couro" passou a "Chaveiro de tira com argola". A palavra "couro" é reservada por lei a couro legítimo.
  - Taças sem "em acrílico".
  - "Copo para café expresso" (era "em inox").
  - "Caneta metálica de clique" (era "de alumínio").
  - "Copo com estampa envolvente" (era "impressão 360°").
  - "Saquinho transparente com zíper" (era "EVA/PVC").
- **Prompts das fotos de grupo e verso:** `docs/PROMPTS-GRUPO-VERSO.md`, com 47 fotos de grupo e 16 de verso, e
  prioridades.

**Ainda para decidir:**
1. **Feito em 18/10/2026: cadastro por modelo no /admin/ (Catálogo › Modelos), com os 52 resumos e usos iniciais.** **Conteúdo próprio por modelo.** Hoje só ~7 palavras por página são exclusivas de cada produto, o que traz risco de
   conteúdo fino para o Google. Proposta:
   - um cadastro por modelo no /admin/: resumo de 2 a 3 frases, usos, medidas quando confirmadas, gênero e título/descrição
     para o Google;
   - até lá, escolher entre indexar assim mesmo ou marcar como `noindex`.
2. **Imagem de compartilhamento por produto.** Hoje todas usam a imagem padrão; seria preciso gerar uma versão
   1200×630 de cada foto.
3. **"Taça de gin em acrílico" na curadoria** (`curadoria.json`, sessão curadoria-cores): alinhar com o novo nome.
