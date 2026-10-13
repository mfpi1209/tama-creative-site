# Blog — tamacreative.com.br/blog/

Guias que atraem quem procura brindes, kits e presentes corporativos e levam essas pessoas à curadoria e ao pedido de proposta. Cada artigo é um arquivo Markdown em `src/blog/`; o build gera as páginas, o RSS, o sitemap e os dados estruturados.

## Editor visual (/admin/)

Endereço: **https://tamacreative.netlify.app/admin/**. Depois da troca de DNS, também funciona em **https://tamacreative.com.br/admin/**. O login é feito com a conta do GitHub.

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
6. **Revisar e aprovar:** mova o card para "Em revisão" e depois para "Pronto". **"Publicar" é a aprovação:** o editor faz o merge na `main`, o Netlify gera o site e a produção é atualizada em alguns minutos.
7. Se o build encontrar um erro (por exemplo, link quebrado ou descrição longa demais), a publicação não acontece e a produção continua como estava. O motivo aparece no log de deploy do Netlify.

Rascunho também pode ser marcado com a chave "Rascunho (não publicar)": ele não vai ao ar nem se for publicado.

### Configuração única (feita pelo responsável pela conta)

| Passo | Onde | O quê |
|---|---|---|
| 1 | GitHub › Settings › Developer settings › OAuth Apps › New OAuth App | Nome: `Editor do blog TaMa`. Homepage: `https://tamacreative.netlify.app`. Authorization callback URL: `https://api.netlify.com/auth/done`. Gere o Client secret |
| 2 | Netlify › site tamacreative › Site configuration › Access & security › OAuth › Install provider | GitHub. Cole o Client ID e o Client secret do passo 1 |
| 3 | Netlify › Site configuration › Build & deploy › Continuous deployment › Link repository | GitHub › `mfpi1209/tama-creative-site`, branch `main`. Comando e pasta vêm do `netlify.toml`. Deixe "Deploy Previews" ligado para pull requests |

O passo 3 dispara o primeiro build da `main` e publica em produção. Em 13/10/2026, o conteúdo do repositório era o mesmo da produção, mais o editor: as 18 páginas foram comparadas uma a uma.

### Publicação depois da ligação com o Git

- **Produção = branch `main`.** Cada push ou merge na `main` gera e publica o site. Para mudar o site, commite e envie (`git push`) só depois do OK.
- O `netlify deploy --prod` pela linha de comando continua funcionando, mas é sobrescrito pelo próximo build da `main`. Prefira o Git.
- Rascunhos com alias (`netlify deploy --alias …`) continuam valendo para aprovações fora do editor.
- O build no Netlify usa Python 3.13 (`netlify.toml`). O plugin `netlify/plugins/cache-imagens` guarda `.cache/` entre builds. Com cache, o build leva segundos; sem cache, cerca de 2 minutos.
- Os logos oficiais têm cópia versionada em `brand/logos/`, porque o Netlify só enxerga o repositório. Se os SVGs de `tama-creative-logos/svg` mudarem, o build local avisa; copie os arquivos e faça commit.
- Os masters dos mockups (`midia/mockups/mestre/`, 51 MB) ficam fora do Git, só neste computador.

## Estrutura

| URL | O que é |
|---|---|
| `/blog/` | Índice: artigo em destaque + cards (tema, título, resumo, data, tempo de leitura) |
| `/blog/<slug>/` | Artigo: caminho, H1, autor TaMa Creative, datas, capa, sumário "Neste guia", texto, Fontes, peças da curadoria, outros guias e chamada para a proposta |
| `/blog/tema/<tema>/` | Página do tema. **Só é criada quando o tema tem 3 artigos publicados**; antes disso o tema aparece só como etiqueta (evita páginas rasas no Google) |
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
| `img/blog/` | Imagens enviadas pelo editor. O build gera AVIF/WebP/JPEG como nas outras fotos |
| `docs/blog-modelo.md` | Modelo para escrever sem o editor |

Gerados a cada build: `dist/admin/config.yml`, `preview.css` e `logo.svg`. O `config.yml` é montado com os temas, as ocasiões, as peças da curadoria e as imagens do site, então o editor só oferece valores que o build aceita.

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
| `tema` | sim | `fim-de-ano`, `boas-vindas`, `politicas`, `eventos`, `sustentabilidade`, `marca`, `uniformes` (lista em `blog.py`, `TEMAS`) |
| `ocasiao` | não | Chave da curadoria (`boas-vindas`, `eventos`, `executivos`, `campanhas`, `lancamentos`, `fim-de-ano`, `reconhecimento`). Gera o link `/brindes-corporativos-premium/?ocasiao=…` |
| `servico` | não | Página de serviço ligada ao artigo (botão no quadro do autor) |
| `proposta` | não | Tipo pré-selecionado no formulário: `brindes`, `kits`, `confeccoes`, `branding`, `integrado` |
| `palavra_chave` | não | Consulta principal; vai para `keywords` do JSON-LD |
| `capa` | sim, ou `capa_arquivo` | Nome de uma imagem de `img/` (`.jpg`) ou `img/v2/` (`.webp`), sem extensão |
| `capa_arquivo` | não | Imagem enviada pelo editor (`/img/blog/arquivo.jpg`). Quando preenchida, substitui `capa` |
| `capa_alt` | sim | Descrição da foto. Com `capa_conceitual` (padrão), o site acrescenta "Fotografia conceitual:" e a legenda |
| `capa_conceitual` | não | `false` só para fotos reais de trabalhos entregues |
| `capa_posicao` | não | Enquadramento CSS, por exemplo `50% 40%` |
| `pecas` | não | Slugs de `src/data/curadoria.json`: peças com foto entram na vitrine (com "+ Selecionar"); ideias "além do óbvio" entram como cards |
| `relacionados` | não | Slugs de artigos para "Outros guias". Sem ele: mesmo tema primeiro, depois os mais recentes |
| `draft` | não | `true` = não publica |

### Recursos no texto

| Recurso | Como escrever |
|---|---|
| Chamada para a proposta no meio do texto | Linha sozinha com `[[cta]]` ou `[[cta: texto próprio]]` |
| Tabelas | Markdown padrão; ficam roláveis no celular |
| Notas de fonte | `texto.[^id]` no corpo e `[^id]: Fonte. [Link](https://…)` no fim |
| Links internos | Caminho relativo (`/kits-corporativos/`). O build confere se a página existe, inclusive âncoras da curadoria |

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

| Artigo | Consulta-alvo | Destino principal | Fontes externas |
|---|---|---|---|
| Brindes de fim de ano para clientes: como escolher sem parecer propaganda (destaque) | brindes de fim de ano para clientes | Curadoria `?ocasiao=fim-de-ano` | Nenhuma (orientação prática) |
| Presente de Natal para funcionários: ideias além da cesta | presente de natal para funcionários | Kits + curadoria fim de ano | Nenhuma |
| Brindes e compliance: limites de valor e política de presentes | política de brindes e presentes | Brindes corporativos | Decreto 10.889/2021, Leis 12.813/2013, 12.846/2013 e 14.520/2023, CF art. 37, Código de Conduta da Alta Administração, CEP, guias CGU 2015 e 2024 (conferidos em 12/10/2026) |
| O que colocar no kit de boas-vindas, inclusive para quem trabalha remoto | o que colocar no kit de boas-vindas | Kits + curadoria boas-vindas | LGPD, arts. 5º e 6º |

**Revisar até janeiro/2027:** o valor em reais do limite de brinde no artigo de compliance. Ele é 1% do subsídio dos ministros do STF, R$ 46.366,19 desde fevereiro de 2025 pela Lei 14.520/2023. Se houver reajuste, atualize o texto, a nota e o campo `updated`.

## Próximas pautas sugeridas

Seguem `docs/SEO.md`:
1. Brindes sustentáveis de verdade: materiais e como evitar greenwashing (precisa de fontes).
2. Uniforme corporativo: tecido, modelagem e bordado x silk.
3. Quanto custa uma identidade visual e o que entra no escopo. Sem preços: falar do que muda o escopo.
4. Kit para evento corporativo, só depois de alinhar com o subdomínio de brindes.

Quando um tema chegar a 3 artigos, a página `/blog/tema/<tema>/` aparece sozinha no próximo build.

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
