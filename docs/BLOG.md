# Blog — tamacreative.com.br/blog/

Guias que atraem quem procura brindes, kits e presentes corporativos e levam essas pessoas ao catálogo, às ideias por ocasião e ao pedido de proposta. Cada artigo é um arquivo Markdown em `src/blog/`; o build gera as páginas, o RSS, o sitemap e os dados estruturados.

## Editor visual (/admin/)

Endereço: **https://tamacreative.com.br/admin/** (servido pelo Easypanel). O login é feito com a conta do GitHub, pelo serviço `cms-auth` do Easypanel (passos 1 a 3 abaixo).

O mesmo editor também administra o **catálogo de produtos** (fotos, cores, material e técnica): ver `docs/BANCO-IMAGENS.md` › Editor do catálogo. `/adm` redireciona para `/admin/`.

O editor é o Decap CMS 3.16.3, servido pelo próprio site, sem script de terceiros. Ele grava no repositório privado **mfpi1209/tama-creative-site**. Só entra quem tem acesso de escrita ao repositório; para dar acesso a outra pessoa, adicione o GitHub dela como colaboradora.

### Como publicar pelo editor

1. **Entrar:** "Entrar com o GitHub".
2. **Novo artigo:** "Artigos do blog" › "+ artigo". Preencha os campos; cada um traz uma dica, e os limites de SEO são validados na hora.
3. **Texto:** use "Título 2" para as seções (entram no sumário) e "Título 3" para subseções. O botão **+** insere "Chamada para proposta" e imagens.
   - Imagens: só fotos próprias ou licenciadas, enviadas pela biblioteca de mídia (ficam em `img/blog/`).
   - Notas de fonte: no modo **Markdown**, escreva `texto[^id]` e, no fim, `[^id]: Fonte. [Link](https://…)`.
4. **Prévia ao lado:** mostra o artigo com o visual do site e um painel de SEO:
   - como o artigo aparece no Google;
   - tamanhos do título e da descrição;
   - palavra-chave no título, na descrição e no primeiro parágrafo;
   - seções, número de palavras, chamada para proposta, serviço e texto alternativo da capa.
5. **Salvar:** cria um rascunho no fluxo editorial ("Fluxo de trabalho"). Por trás, é um pull request no GitHub. O Netlify gera uma **prévia com endereço próprio**; o link aparece no editor ("Ver prévia"). A prévia fica fora do Google.
6. **Revisar e aprovar:** mova o card para "Em revisão" e depois para "Pronto". **"Publicar" é a aprovação:** o editor faz o merge na `main`; o GitHub Actions gera e testa o site e atualiza a branch `deploy`, e o Easypanel publica (ver `docs/DEPLOY.md`).
7. Se o build ou os testes encontrarem um erro (por exemplo, link quebrado ou descrição longa demais), a publicação não acontece e a produção continua como estava. O motivo aparece no log do GitHub Actions (ou no log da prévia do Netlify).

Rascunho também pode ser marcado com a chave "Rascunho (não publicar)": ele não vai ao ar nem se for publicado.

## Painel de SEO (/admin/painel/)

Endereço: **https://tamacreative.netlify.app/admin/painel/**, ou o botão "Painel de SEO" no canto do editor. Usa o mesmo login do editor: entre primeiro em `/admin/`.

A página não traz dados. Ela lê os artigos (`src/blog/`), as pautas (`src/pautas/`) e os rascunhos do fluxo editorial direto do repositório privado, com o token do GitHub que o editor guarda no navegador. Só vê quem tem acesso ao repositório. O build publica apenas `/admin/painel/site.json`, com as opções do editor e as consultas das páginas do site (públicas de qualquer forma).

| Aba | O que mostra |
|---|---|
| Visão geral | Números do blog, "O que fazer agora" (revisões e prazos dos próximos 30 dias, erros que o build recusa, conflitos de palavra-chave, pautas desalinhadas com o artigo), rascunhos no fluxo editorial e o progresso de cada tema até a página própria |
| Pautas | Quadro por status (ideia → aprovada → escrevendo → em revisão → publicada; em espera e descartadas à parte), com tema, prioridade, prazo e pico. "Começar artigo" abre um artigo novo já com título, palavra-chave, tema e serviço |
| Calendário | Próximos 12 meses: prazos das pautas, publicações agendadas, revisões e meses de pico. Itens vencidos aparecem em "Atrasados" |
| Palavras-chave | Todas as consultas (páginas do site, artigos e pautas) e os conflitos: mesma consulta = alto; 75% ou mais dos termos em comum = médio |
| Auditoria | Cada artigo, inclusive rascunhos, com as checagens do painel de SEO do editor, links internos, citações por outros artigos e conflitos |
| Revisões | Artigos publicados por data da próxima revisão |

As consultas das páginas do site ficam em `CONSULTAS_PAGINAS`, no `blog.py`. Ao mudar o mapa de palavras-chave de `docs/SEO.md`, atualize as duas.

### Pautas

Cada pauta é um arquivo em `src/pautas/`, editado em "Pautas" no editor: título provisório, consulta-alvo, consultas secundárias, status, prioridade, intenção de busca, tema, página de destino, prazo ("Publicar até"), meses de pico, se precisa de fontes, responsável, artigo ligado, observação e um briefing (público, perguntas, esboço, links internos e fontes).

- Pautas passam pelo mesmo fluxo do editor (rascunho → revisão → publicar). "Publicar" só grava no repositório: nada de pauta vai para o site.
- Quando o artigo for criado, preencha o campo "Artigo" da pauta. Sem ele, o painel liga pela consulta-alvo e lembra de ligar.
- Meses de pico só com dado (Search Console, Keyword Planner ou Google Trends).
- O build confere status, tema, destino, prioridade, intenção, meses e artigo das pautas. Uma pauta inválida impede o build, como um artigo inválido.

### Revisão dos artigos

Os campos "Próxima revisão" (`revisar_em`) e "O que revisar" (`revisar_motivo`) marcam quando conferir de novo um artigo com lei, valor ou dado que pode mudar. Depois de revisar, atualize "Atualizado em" e marque a próxima data.

### Testar o painel localmente

Rode o build, sirva `dist/` e, na pasta do projeto, `npx decap-server` (porta 8081). Sem login do GitHub, o painel em `localhost` lê os arquivos por esse servidor. O fluxo editorial (pull requests) só aparece com o login do GitHub.

### Configuração única (feita pelo responsável pela conta)

O login do editor roda no Easypanel: o serviço `cms-auth` (código em `deploy/cms-auth/`) faz o OAuth com o GitHub e o Nginx do site o expõe em `https://tamacreative.com.br/api/cms-auth/`. O Netlify não participa do login.

| Passo | Onde | O quê |
|---|---|---|
| 1 | GitHub › Settings › Developer settings › OAuth Apps › **New OAuth App** | Nome: `Editor do site TaMa`. Homepage URL: `https://tamacreative.com.br`. Authorization callback URL: `https://tamacreative.com.br/api/cms-auth/callback`. Registre, copie o **Client ID** e gere o **Client secret** |
| 2 | Easypanel › projeto `tama` › app **`cms-auth`** › **Environment** | `GITHUB_CLIENT_ID=` e `GITHUB_CLIENT_SECRET=` do passo 1. Salve e clique em **Deploy**. Não precisa de domínio: o acesso é pela rede interna |
| 3 | Easypanel › app do site › **Deploy** | Publica o Nginx que encaminha `/api/cms-auth/` para `tama_cms-auth` |

O Nginx procura o serviço pelo nome interno **`tama_cms-auth`**, na **porta 80** (a porta que o serviço informa no log: "cms-auth na porta 80"). Se o projeto, o serviço ou a porta forem outros, ajuste `set $cms_auth_upstream` em `deploy/nginx.conf`.

Quem edita precisa de acesso de escrita ao repositório `mfpi1209/tama-creative-site` (colaborador no GitHub).

### Publicação

- **Produção = branch `main` → GitHub Actions → Easypanel** (ver `docs/DEPLOY.md`). Commite e envie (`git push`) só depois do OK.
- O Netlify não publica mais o site: `tamacreative.netlify.app` redireciona para o domínio. Se o Netlify continuar ligado ao repositório, as prévias de pull request geram o site completo para revisão.
- Os logos oficiais têm cópia versionada em `brand/logos/`, porque o build só enxerga o repositório. Se os SVGs de `tama-creative-logos/svg` mudarem, o build local avisa; copie os arquivos e faça commit.
- Os masters dos mockups (`midia/mockups/mestre/`, 51 MB) ficam fora do Git, só neste computador.

## Estrutura

| URL | O que é |
|---|---|
| `/blog/` | Índice: abertura curta, um artigo em destaque (o marcado com `destaque`, sem repetir na grade), filtros por categoria e cards (categoria, título, resumo). Os filtros são botões que só aparecem com JavaScript; sem ele, todos os cards ficam visíveis |
| `/blog/<slug>/` | Artigo: caminho, categoria, H1, resumo, autor Equipe TaMa Creative (link para /sobre/), datas, capa com legenda, sumário "Neste guia" (um só `<details>`: aberto ao lado do texto no desktop, fechado no celular), texto em coluna de 720 px, peças da curadoria, até 2 outros guias e chamada para a proposta. Artigo sem `servico` nem `proposta` (compliance) fica só editorial: sem vitrine, sem botões de proposta e sem a faixa final |
| `/blog/tema/<categoria>/` | Página da categoria. **Só é criada quando a categoria tem 3 artigos publicados**; antes disso a categoria aparece só como etiqueta e filtro (evita páginas rasas no Google) |
| `/blog/feed.xml` | RSS 2.0 com os artigos publicados |
| `/blog/<slug>/og.jpg` | Imagem de compartilhamento 1200×630 gerada da capa + logo oficial |

Cada artigo traz:
- **JSON-LD:** `BlogPosting`, com autor e editor = Organization `#org`, mais `BreadcrumbList`. O índice tem `Blog` + `CollectionPage`.
- **Metadados de compartilhamento:** `og:type=article` e `article:published_time`.
- **Sitemap:** entra com `lastmod` igual à data de atualização.
- **Navegação:** "Blog" fica no menu e no rodapé.

### Arquivos

| Arquivo | Papel |
|---|---|
| `blog.py` | Lê, valida e gera o blog e o editor. Ganchos em `build.py`: `blog.image_sources()`, `blog.pages()`, `blog.finalize()` e `blog.post_static()` |
| `src/blog.css` | Estilos do blog, carregados só nas páginas do blog |
| `src/blog/*.md` | Um arquivo por artigo. O nome do arquivo é o endereço: `kit-de-boas-vindas.md` → `/blog/kit-de-boas-vindas/` |
| `src/admin/` | Editor: `index.html`, `admin.js` (prévia, painel de SEO, bloco "Chamada para proposta") e `vendor/decap-cms-3.16.3/` |
| `src/admin/painel/` | Painel de SEO (`/admin/painel/`), com `vendor/js-yaml-4.1.0/` para ler o front matter |
| `src/pautas/*.md` | Pautas do planejamento editorial. Ficam só no repositório |
| `img/blog/` | Imagens enviadas pelo editor. O build gera AVIF/WebP/JPEG como nas outras fotos |
| `docs/blog-modelo.md` | Modelo para escrever sem o editor |

Gerados a cada build: `dist/admin/config.yml`, `preview.css` e `logo.svg`. O `config.yml` é montado com os temas, as ocasiões, os modelos do catálogo e as imagens do site, então o editor só oferece valores que o build aceita.

Em `build.py` o blog ocupa só o import, o item do menu e do rodapé, `og_type`/`og_image`/`head` no `shell()`, o `lastmod` do sitemap e os ganchos. Dependências: `Markdown` e `PyYAML` (em `requirements.txt`).

## Publicar um artigo sem o editor (arquivo + Git)

1. **Escolha a pauta** na "Estratégia editorial" de `docs/SEO.md`. Um artigo responde uma consulta principal e aponta para uma página de serviço.
2. **Copie o modelo:** `docs/blog-modelo.md` → `src/blog/endereco-do-artigo.md`. O nome vira a URL; use minúsculas, sem acentos, com hífens.
3. **Preencha o front matter** (tabela abaixo; é YAML, então textos com dois-pontos vão entre aspas) e deixe `draft: true` enquanto escreve.
4. **Escreva em Markdown.** Use `##` para seções e `###` para subseções; o H1 vem do `title`, então não use `#` no texto.
5. **Cite as fontes.** Todo fato externo (lei, número, estudo) leva nota de rodapé `[^id]` com o link oficial. As notas viram a seção "Fontes". Enquanto falta fonte, escreva `[fonte?]`: o build recusa publicar.
6. **Veja localmente** (rascunhos aparecem com aviso e `noindex`):
   ```bash
   BLOG_DRAFTS=1 python build.py
   python -m http.server 8099 --directory dist
   ```
   No PowerShell, rode `$env:BLOG_DRAFTS=1; python build.py`. Abra http://127.0.0.1:8099/blog/.
7. **Libere:** troque para `draft: false` e ajuste `date` para o dia da publicação.
8. **Gere e teste:** rode `python build.py` e depois `node tests/e2e.mjs http://127.0.0.1:8099`. Os testes do blog contam os artigos; ao publicar um novo, atualize o número esperado (hoje 4) na seção "Blog" de `tests/e2e.mjs`.
9. **Rascunho para aprovação:**
   ```bash
   netlify deploy --no-build --dir dist --functions netlify/functions --alias blog-rascunho
   ```
10. **Produção, depois do OK:** `git add src/blog/… && git commit && git push`. Com o Netlify ligado ao repositório, o push na `main` publica. Antes da ligação, use `netlify deploy --no-build --prod --dir dist --functions netlify/functions`.
    No Search Console, peça a indexação da URL nova.

### Campos do front matter

| Campo | Obrigatório | Uso |
|---|---|---|
| `title` | sim | H1 e título do card (até 110 caracteres) |
| `seo_title` | recomendado | `<title>` (até 70; ideal até 65). Sem ele: `title | TaMa Creative` se couber |
| `description` | sim | Meta description, resumo do card e linha fina (70 a 160 caracteres) |
| `breadcrumb` | não | Versão curta do título no caminho |
| `date` | sim | Publicação (`AAAA-MM-DD`). Data futura = não publica |
| `updated` | não | Última revisão relevante; vira `dateModified` e `lastmod` |
| `destaque` | não | `true` põe o artigo em destaque no índice entre os do mesmo dia |
| `tema` | sim | Categoria: `brindes-e-presentes`, `kits-e-boas-vindas`, `confeccoes-e-personalizacao`, `embalagem-e-acabamento`, `eventos-e-ativacoes`, `hotelaria-e-gastronomia`, `planejamento-de-compras` (lista em `blog.py`, `TEMAS`). Vira filtro na listagem quando há artigo |
| `resumo` | não | Frase curta do card e da linha abaixo do H1 (até 160). Vazio usa `description` |
| `ocasiao` | não | Chave da curadoria (`boas-vindas`, `eventos`, `executivos`, `campanhas`, `lancamentos`, `fim-de-ano`, `reconhecimento`). Gera o link `/brindes-por-ocasiao/?ocasiao=…` |
| `servico` | não | Página de serviço ligada ao artigo (botão no quadro do autor) |
| `proposta` | não | Tipo pré-selecionado no formulário: `brindes`, `kits`, `confeccoes`, `ativacoes`, `hotelaria`, `integrado` |
| `palavra_chave` | não | Consulta principal; vai para `keywords` do JSON-LD |
| `capa` | sim, ou `capa_arquivo` | Nome de uma imagem de `img/` (`.jpg`) ou `img/v2/` (`.webp`), sem extensão |
| `capa_arquivo` | não | Imagem enviada pelo editor (`/img/blog/arquivo.jpg`). Quando preenchida, substitui `capa` |
| `capa_alt` | sim | Descrição da foto. Com `capa_conceitual` (padrão), o site acrescenta "Fotografia conceitual:" e a legenda |
| `capa_conceitual` | não | `false` só para fotos reais de trabalhos entregues |
| `capa_legenda` | não | Legenda da capa, por exemplo `Imagem ilustrativa · Marcas fictícias`. Com ela, o texto alternativo fica só com `capa_alt` |
| `capa_posicao` | não | Enquadramento CSS, por exemplo `50% 40%` |
| `pecas` | não | Ids de modelo do catálogo (`src/data/produtos.json`, ex.: `caneca`, `polo-masculina`), escolhidos no editor em **Peças do catálogo** (até 9). Entram no fim do artigo com "+ Selecionar". Slugs antigos da curadoria continuam aceitos pelos `aliases` de `src/data/selecoes.json` |
| `relacionados` | não | Até 2 slugs de artigos para "Outros guias". Sem ele: mesma categoria primeiro, depois os mais recentes |
| `revisar_em` | não | Próxima revisão (`AAAA-MM-DD`). Aparece no Painel de SEO |
| `revisar_motivo` | não | O que conferir na revisão. Exige `revisar_em` |
| `draft` | não | `true` = não publica |

### Recursos no texto

| Recurso | Como escrever |
|---|---|
| Chamada para a proposta no meio do texto | Linha sozinha com `[[cta]]` ou `[[cta: texto próprio]]` |
| Tabelas | Markdown padrão; ficam roláveis no celular |
| Notas de fonte | `texto.[^id]` no corpo e `[^id]: Fonte. [Link](https://…)` no fim |
| Links internos | Caminho relativo (`/kits-corporativos/`). O build confere se a página existe, inclusive âncoras de `/brindes-por-ocasiao/` (`#pecas` ou id de modelo) |

## O que o build verifica

O build para com a lista de erros quando:
- falta campo obrigatório, ou o slug está repetido ou é inválido;
- `title`, `seo_title` ou `description` passam do tamanho;
- tema, ocasião, tipo de proposta, peça, capa ou artigo relacionado não existe;
- algum link interno está quebrado, ou existe link `http://`;
- o texto tem `#` (H1), `[fonte?]`, `TODO` ou atalho `[[…]]` desconhecido.

## Regras editoriais

- **Nada inventado:** sem estatísticas, preços, prazos, quantidades mínimas, clientes ou resultados. Fato externo só com fonte oficial ou verificável, citada em nota.
- **Assuntos jurídicos:** dizer que o texto não é orientação jurídica e citar a norma (artigo e link do Planalto/gov.br). Revisar as normas citadas a cada atualização.
- **Imagens:** só fotos próprias ou conceituais da TaMa. Conceituais são identificadas como tal (é o padrão). Nada de banco de imagens ou fornecedor sem licença.
- **Tom:** elegante, objetivo e humano. A marca do cliente é a protagonista ("Sua marca. Nossa criatividade.").
- **Links:** cada artigo aponta para uma página de serviço, para a curadoria filtrada quando houver ocasião e para a proposta.
- **Uma consulta por artigo:** não criar páginas parecidas disputando a mesma busca, inclusive com o subdomínio de brindes populares. "Kit para evento corporativo" fica em espera por causa do `/kits-para-eventos/` planejado lá.

## Artigos publicados (outubro/2026)

Em 18/10/2026 os quatro textos foram substituídos pelos do pacote de refatoração (`TaMa_Blog_Completo`), com título, descrição, resumo e consulta do `seo.json` do pacote e capas próprias (1672×941 px, imagens ilustrativas com marcas fictícias, em `img/blog/`). Os endereços e a data de publicação (12/10/2026) não mudaram; "Atualizado em" é 18/10/2026.

| Artigo | Categoria | Consulta-alvo | Destino principal | Fontes externas |
|---|---|---|---|---|
| Brindes de fim de ano para clientes: como escolher um presente que faça sentido (destaque) | Brindes e presentes | brindes de fim de ano para clientes | Curadoria `?ocasiao=fim-de-ano` | Nenhuma |
| Presente de Natal para funcionários: como escolher para a equipe | Brindes e presentes | presente de natal para funcionários | Brindes corporativos | Nenhuma |
| O que colocar no kit de boas-vindas: escolhas para receber sua equipe | Kits e boas-vindas | o que colocar no kit de boas-vindas | Kits corporativos | Nenhuma |
| Brindes e compliance: o que conferir antes de presentear | Planejamento de compras | brindes e compliance | Nenhum (só editorial) | Decreto 10.889/2021, CGU (brindes, presentes e hospitalidades) e Lei 12.846/2013, consultados em 18/10/2026 |

O artigo de compliance não cita mais um valor em reais: ele orienta a verificar o parâmetro vigente. **Revisar até 31/01/2027** (`revisar_em`): conferir as três fontes oficiais e atualizar o texto se mudarem.

A chamada final do artigo de fim de ano não fala em taças e copos, porque a curadoria do site não tem essas peças. O texto do artigo continua citando taças como opção a considerar.

## Rascunhos do pacote de 50 artigos (18/10/2026)

50 guias curtos (cerca de 300 palavras) do pacote `TaMa_Blog_50` estão em `src/blog/` com `draft: true`: não aparecem no site nem no sitemap. As capas, geradas por IA, ficam em `img/blog/capa-<slug>.jpg` (JPEG de alta qualidade, a partir dos PNG de 1672×941 do pacote) e trazem a legenda "Imagem ilustrativa gerada por IA".

Na importação: os links para `/confeccoes/` passaram para `/confeccoes-personalizadas/`; as rotas inexistentes `/ativacoes/` e `/gastronomia-e-hotelaria/` saíram do texto (esses artigos ficam sem página de serviço e com proposta do tipo integrado); a linha final de links comerciais virou `[[cta]]`. Cada artigo ganhou título curto, palavra-chave, resumo e até 2 relacionados.

Antes de liberar um bloco (trocar `draft` para `false` e `date` para o dia da publicação):
- publique juntos os artigos que se citam, ou o build recusa o link para um rascunho;
- confira as afirmações sobre normas sem fonte em `brindes-alegacoes-ambientais` (publicidade ambiental), `brindes-tecnologicos` (homologação), `degustacao-pdv-materiais`, `jogos-americanos`, `cardapios-personalizados` (alimentos), `aventais-personalizados`, `dolmas-personalizadas`, `uniformes-equipes-funcoes` e `uniforme-promotores` (EPI);
- decida `kit-eventos-corporativos`: a busca "kit para evento corporativo" está em espera por causa do `/kits-para-eventos/` do subdomínio de brindes;
- confirme a oferta antes de publicar artigos de produto que o site não mostra (taças, copos, cardápios, porta-contas, materiais de ativação) e o que `kit-versoes-publicos` promete sobre trocar itens depois da aprovação;
- vigie a canibalização apontada no Painel de SEO: `kit-onboarding-presencial` × `o-que-colocar-no-kit-de-boas-vindas`, `presentes-agradecimento-parceiros` e `kit-relacionamento-clientes` × `brindes-de-fim-de-ano-para-clientes`, `entrega-brindes-multiplos-enderecos` × `kit-home-office-envio`, `brindes-alegacoes-ambientais` × pauta de brindes sustentáveis.

## Próximas pautas sugeridas

Seguem `docs/SEO.md`:
1. Brindes sustentáveis de verdade: materiais e como evitar greenwashing (precisa de fontes).
2. Uniforme corporativo: tecido, modelagem e bordado x silk.
3. Quanto custa uma identidade visual e o que entra no escopo. Sem preços: falar do que muda o escopo.
4. Kit para evento corporativo, só depois de alinhar com o subdomínio de brindes.

Quando uma categoria chegar a 3 artigos, a página `/blog/tema/<categoria>/` aparece sozinha no próximo build.

## Verificações da refatoração (18/10/2026, local)

- `python build.py` sem erros; links internos, capas e relacionados validados pelo build.
- Listagem e quatro artigos em 360, 390, 768 e 1440 px: sem rolagem horizontal, um H1 por página, destaque sem repetir na grade, filtros funcionando (Todos + 3 categorias) e console sem erros.
- Sumário: aberto ao lado do texto no desktop e recolhido no celular, sem HTML duplicado.
- Compliance sem vitrine, sem botões de proposta e sem faixa final; três fontes oficiais citadas no texto.
- Canonical, robots, title, `og:type`, `twitter:card`, `BlogPosting` e `BreadcrumbList` mantidos; sitemap com `lastmod` 2026-10-18.
- O `tests/e2e.mjs` foi atualizado, mas não rodou neste computador (falta o puppeteer); as checagens equivalentes foram feitas no navegador.
- Lighthouse e axe-core não foram refeitos depois da refatoração.

## Verificações (12/10/2026, rascunho blog-rascunho)

- Editor (13/10/2026): 71/71 no `tests/e2e.mjs`, com 4 novos do `/admin/`. Também testei de ponta a ponta com o servidor local do Decap:
  - um artigo editado no modo visual e salvo gera exatamente o mesmo HTML (notas de fonte, tabela e `[[cta]]` preservados);
  - capa enviada e foto no texto viram imagens otimizadas com legenda;
  - no rascunho `editor-rascunho`, o `/admin/` abre sem erros, com a política de segurança própria.
- `tests/e2e.mjs`: 67/67 aprovados, dos quais 26 são do blog. Cobrem:
  - índice com 4 artigos e o destaque certo;
  - Blog no menu e no rodapé;
  - um H1, canonical, `og:type=article` e imagem OG por artigo;
  - JSON-LD `BlogPosting` e `BreadcrumbList`;
  - CTA com tipo de proposta, sumário com âncoras válidas e links para a curadoria filtrada;
  - fontes no artigo de compliance e links internos com resposta 200;
  - seleção de peça a partir do artigo;
  - RSS e sitemap.
- axe-core (WCAG 2.0/2.1/2.2 A e AA + boas práticas): 0 violações no índice e nos 4 artigos. Sem rolagem horizontal em 1440, 1024, 768, 390 e 320 px. Console sem erros. O menu com "Blog" cabe numa linha de 1081 a 1440 px.
- Lighthouse 13.5 (laboratório, Edge):

| Página | Celular (Perf · A11y · BP · SEO) | LCP celular | Desktop |
|---|---|---|---|
| `/blog/` | 99 · 100 · 100 · 100 | 1,9 s | 100 · 100 · 100 · 100 |
| Brindes de fim de ano para clientes | 99 · 100 · 100 · 100 | 1,9 s | 100 · 100 · 100 · 100 |
| Brindes e compliance | 99 · 100 · 100 · 100 | 1,9 s | 100 · 100 · 100 · 100 |

CLS ≤ 0,001.
