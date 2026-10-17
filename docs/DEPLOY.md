# Configuração e deploy — Netlify

## Estrutura
```
tama-site/
  build.py                  gerador estático (Python)
  site.config.json          configuração pública (domínio, contatos, GA4)
  src/styles.css            estilos e tokens de design
  src/site.js               comportamento (menu, filtros, seleção, formulário, analytics)
  src/data/curadoria.json   38 itens: 21 peças com foto (pecas) + 17 além do óbvio (alem); cores, materiais, técnicas, ocasiões
  src/fonts/                fontes DM Sans e Playfair Display (woff2, OFL)
  img/                      imagens-fonte; img/v2/ = fotos conceituais da v2; img/marca/ = as mesmas com a marca aplicada (o build gera AVIF/WebP/JPEG em vários tamanhos)
  midia/mockups/            mockups com a marca: mestre (alta), web, miniatura e manifest.json (não vai para o site)
  tools/sync_mockups.py     copia midia/mockups/web para img/marca/ e grava src/data/mockups.json
  netlify/functions/        função submission-created (repasse ao n8n)
  netlify.toml              configuração do Netlify
  tests/e2e.mjs             testes de fluxos críticos
  docs/                     esta documentação
  dist/                     site gerado (não editar à mão)
```
O logo e o selo vêm de `../tama-creative-logos/svg/`.

## Build
```bash
pip install -r requirements.txt
python build.py
```
O build falha se encontrar placeholders (`[WhatsApp]` etc.) no HTML.

## Configuração (site.config.json ou variáveis de ambiente)
| Chave / variável | Uso | Exemplo |
|---|---|---|
| `site_url` / `SITE_URL` | Canonical, sitemap, Open Graph | `https://tamacreative.com.br` |
| `whatsapp` / `WHATSAPP` | Botões e link wa.me (só dígitos, com DDI) | `5511999999999` |
| `email` / `EMAIL` | Contato no rodapé e na proposta | `contato@tamacreative.com.br` |
| `instagram` / `INSTAGRAM` | Link e `sameAs` no JSON-LD | `tamacreative` |
| `ga4_id` / `GA4_ID` | Ativa GA4 com banner de consentimento | `G-XXXXXXX` |
| `redirect_netlify_subdomain` / `REDIRECT_NETLIFY_SUBDOMAIN` | Redireciona o .netlify.app para o domínio | `true` (só depois do DNS) |
| `mockups_marca` / `MOCKUPS_MARCA` | Usa as imagens com a marca (`img/marca/`), o bloco "Sua marca é a protagonista", o selo nos cards e os avisos de mockup | `true` (em produção desde 12/10/2026) |

Contato vazio = o elemento não aparece. Nada disso é segredo.

## Variáveis secretas (só no painel do Netlify)
Site configuration › Environment variables:
| Variável | Uso |
|---|---|
| `N8N_WEBHOOK_URL` | URL do webhook do n8n que recebe cada pedido |
| `N8N_WEBHOOK_SECRET` | Opcional. Vai no cabeçalho `X-TaMa-Secret`; valide no n8n |

Payload enviado ao n8n:
```json
{ "source": "tamacreative-site", "form": "proposta", "submission_id": "...", "created_at": "...",
  "site_url": "...", "data": { "nome": "", "empresa": "", "contato": "", "tipo": "", "quantidade": "",
  "data": "", "orcamento": "", "objetivo": "", "selecao": "", "consentimento": "sim" } }
```
Sem `N8N_WEBHOOK_URL`, os pedidos continuam chegando por e-mail e ficam em Forms no painel. Depois de criar a variável, publique de novo para a função passar a usá-la.

## Repositório Git e deploy contínuo
O site está no repositório privado **github.com/mfpi1209/tama-creative-site** (branch `main`). Depois de ligar o Netlify ao repositório (passo a passo em `BLOG.md` › "Configuração única"), **cada push na `main` publica em produção** e cada pull request ganha uma prévia. Commite só os seus próprios arquivos e faça `git push` só depois do OK. O editor do blog (`/admin/`) usa esse mesmo fluxo.

## Deploy (CLI)
```bash
netlify deploy --no-build --dir dist --functions netlify/functions            # rascunho (URL de teste, noindex)
netlify deploy --no-build --dir dist --functions netlify/functions --alias v2-aprovacao   # rascunho com endereço fixo
netlify deploy --no-build --prod --dir dist --functions netlify/functions     # produção
```
Site Netlify: `tamacreative` (conta tatydalves). Formulário: `proposta`, com aviso por e-mail para tatydalves@gmail.com.

## Easypanel (Nginx): cabeçalhos e /admin/
No Easypanel o site roda numa imagem Nginx (`Dockerfile` ou `deploy/Dockerfile.static`, montada pelo `.github/workflows/deploy.yml`). O Nginx não lê o `_headers`, então os cabeçalhos ficam em:

| Arquivo | O quê |
|---|---|
| `deploy/common-headers.conf` | nosniff, Referrer-Policy, X-Frame-Options, Permissions-Policy (todo o site, inclusive `/admin/`) |
| `deploy/security-headers.conf` | os comuns + a CSP do site. **Duplicada** da CSP de `build.py` (`_headers`): mude as duas juntas |
| `dist/_nginx/admin-headers.conf` | **gerado pelo `blog.py`** a partir de `ADMIN_CSP` (a mesma do bloco `/admin/*` do `_headers`): os comuns + CSP do editor (`'unsafe-eval'`, `api.github.com`, `api.netlify.com`), `X-Robots-Tag: noindex, nofollow` e `Cache-Control: no-cache` |

O `deploy/nginx.conf` usa o arquivo gerado em `location /admin/` (editor Decap e Painel de SEO); `/admin` sem barra vira 301 para `/admin/`. Os Dockerfiles movem `admin-headers.conf` para `/etc/nginx/snippets/`, apagam `_nginx/`, `_headers` e `_redirects` da pasta pública e rodam `nginx -t` (a imagem não monta se a configuração estiver errada). Para mudar a CSP do editor, mude só `ADMIN_CSP` no `blog.py`.

Conferir depois de publicar:
```bash
curl -sI https://tamacreative.com.br/admin/ | grep -i -E "content-security|x-robots|cache-control"
curl -sI https://tamacreative.com.br/ | grep -i content-security
```
`/admin/` e `/admin/painel/` devem mostrar `'unsafe-eval'` e `api.github.com`; o resto do site, a CSP com `googletagmanager.com`.

**Login do editor fora do Netlify.** O Decap faz o login do GitHub pelo Netlify (`base_url: https://api.netlify.com`, `site_domain: tamacreative.netlify.app` no `config.yml`). Isso funciona em qualquer domínio, inclusive no `tamacreative.com.br` servido pelo Easypanel, desde que:
1. o site `tamacreative` continue existindo no Netlify (não apague o site, mesmo sem usar a hospedagem);
2. o provedor GitHub esteja instalado nele (BLOG.md › "Configuração única", passos 1 e 2);
3. a CSP de `/admin/` libere `api.netlify.com` e `api.github.com` (já libera) e nenhum cabeçalho `Cross-Origin-Opener-Policy` seja adicionado em `/admin/`, porque a janela de login responde ao editor por `window.opener`.

Em 17/10/2026, `https://api.netlify.com/auth?provider=github&site_id=tamacreative.netlify.app` respondia 404, igual a um site inexistente: sinal de que o passo 2 ainda não foi feito (ou foi feito em outro site). Teste o botão "Entrar com o GitHub" em `https://tamacreative.netlify.app/admin/` antes de desligar o Netlify. Se o Netlify for abandonado de vez, a alternativa é um servidor OAuth próprio (por exemplo, um container com `decap-cms-oauth` no Easypanel) e trocar `base_url`/`site_domain` em `blog.py`, com a nova origem no `connect-src` de `ADMIN_CSP`.

## Domínio
1. Registro.br › DNS › Alterar servidores DNS: `dns1.p01.nsone.net`, `dns2.p01.nsone.net`, `dns3.p01.nsone.net`, `dns4.p01.nsone.net`.
2. O Netlify já tem a zona com os registros do site e do `www`; o certificado HTTPS é emitido sozinho.
3. Depois que o domínio abrir com cadeado: `REDIRECT_NETLIFY_SUBDOMAIN=true`, build e deploy.

## Testes
```bash
python -m http.server 8099 --directory dist      # em outro terminal
npm i -D puppeteer-core@25.12.0                  # uma vez
node tests/e2e.mjs http://127.0.0.1:8099
```
Requer Edge ou Chrome instalado (`EDGE_PATH` para outro caminho). O envio do formulário é interceptado; nada é enviado ao Netlify.
