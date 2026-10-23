# Inventário de produtos e kits (/admin/inventario/)

Tela para a TaMa operar o catálogo sozinha: ver o que está no site, o que é novo e o que está fora, decidir o que entra
e o que sai, editar textos, enviar fotos e criar produtos e kits. Nada muda no site até clicar em **Publicar**.

Endereço: **https://tamacreative.com.br/admin/inventario/** (ou **/inventario**). Login com **usuário e senha** da
TaMa, sem conta no GitHub (app `admin-api` do Easypanel, abaixo). A equipe técnica também pode entrar com o login do
GitHub do editor (`/admin/`).

## Acesso com usuário e senha (app `admin-api`)
O serviço `deploy/admin-api/server.py` confere a senha, abre uma sessão (cookie assinado, HttpOnly, 12 horas) e grava
no GitHub com um token que fica só no servidor. O Nginx do site encaminha `/api/admin/` para ele; o login aceita
poucas tentativas por minuto (Nginx) e trava o IP após 5 senhas erradas em 15 minutos. Senhas são guardadas só como
hash (PBKDF2-SHA256).

### Ligar no Easypanel (uma vez)
1. **Token do GitHub**: em github.com › Settings › Developer settings › Personal access tokens › Fine-grained tokens ›
   Generate new token. Repository access: só `mfpi1209/tama-creative-site`. Permissions › Repository: **Contents:
   Read and write** e **Pull requests: Read and write**. Validade: 1 ano (anote a data para renovar).
2. **Usuário e senha**: no computador, na pasta do site, `python3 tools/admin_senha.py tama` (digite a senha duas vezes;
   mínimo 10 caracteres). Sai uma linha `tama:pbkdf2-sha256.310000.…` (sem "$", para o Easypanel não interpretar como variável). Para mais pessoas, repita com outro nome.
3. **Segredo das sessões**: `python3 tools/admin_senha.py --segredo`.
4. No Easypanel, no mesmo projeto do site: **+ Service › App**, nome **`admin-api`**. Source: GitHub
   `mfpi1209/tama-creative-site`, branch `main`, Build path **`deploy/admin-api`**, Dockerfile. Sem domínio.
5. Environment do app:
   ```
   GITHUB_TOKEN=<token do passo 1>
   ADMIN_USUARIOS=<linha do passo 2>;<outra linha, se houver>
   ADMIN_SEGREDO=<valor do passo 3>
   ```
   (opcionais: `GITHUB_REPO`, `GITHUB_BRANCH`, `ALLOWED_ORIGIN`, `SESSAO_HORAS`.) Deploy.
6. Confira: `https://tamacreative.com.br/api/admin/health` responde `ok` e `/admin/inventario/` pede usuário e senha.
   O nome interno precisa ser `tama_admin-api` (projeto `tama`, app `admin-api`), que é o que o Nginx procura; com
   outro projeto, ajuste `deploy/nginx.conf`.

Trocar a senha: gere a linha de novo e substitua em `ADMIN_USUARIOS` (Deploy). Tirar o acesso: apague a linha; a sessão
aberta cai na hora. Trocar `ADMIN_SEGREDO` desconecta todo mundo. Cada publicação registra no commit quem publicou.

## Abas
| Aba | O que mostra |
|---|---|
| **Resumo** | Modelos no site, produtos novos, existentes com cores novas e fora do site; tabela por categoria; o que **entra** e o que **sai** com as alterações ainda não publicadas; botão "Aprovar todos os novos". |
| **Produtos** | Um card por modelo, com busca, categoria e filtros (Existentes, Produtos novos, Cores novas, Fora do site, Com alteração). Clique para abrir. |
| **Kits** | Os kits da home, de `/kits-corporativos/` e da página de fim de ano. |
| **Alterações** | A lista do que muda, item por item (Entra, Sai, Alterado), com Desfazer, os erros que bloqueiam a publicação e os botões Publicar, Salvar como rascunho e Descartar tudo. Mostra também os rascunhos salvos. |

## Situação de cada foto (campo `aprovacao` em `src/data/produtos.json`)
| Na tela | Valor | No site |
|---|---|---|
| No site | `aprovada` | aparece |
| Novo (produto novo ou cor nova) | `revisao` | aparece; aguarda a aprovação da TaMa |
| Trocar foto | `substituir` | não aparece até chegar a foto nova |
| Fora do site | `retirada` | não aparece |

Um modelo é **produto novo** quando todas as fotos visíveis estão em `revisao`, e **existente com cores novas** quando
só algumas estão. "Tirar do site" marca todas as fotos como `retirada`; "Voltar ao site" volta para `aprovada`. Textos,
ocasiões e posição do modelo ficam guardados: o build ignora em `modelos.json`, `selecoes.json` e nas páginas os
modelos que estão inteiros fora do site (`FORA_DO_SITE` em `build.py`), em vez de falhar.

Em 22/10/2026 as 464 fotos que já estavam no site antes da apresentação de 20/10 foram marcadas como `aprovada`; as
367 da apresentação ficaram em `revisao` (novos, para a TaMa aprovar).

## O que dá para fazer
- **Produto**: nome no site, categoria, gênero, descrição curta do modelo, resumo, "ideal para", medidas (com situação),
  ocasiões, título e descrição no Google; tirar do site, voltar, aprovar as fotos novas.
- **Fotos e cores**: situação, nome e bolinha da cor, texto alternativo, material e técnica (com "confirmado"), foto
  principal do card e **trocar a foto**; **adicionar cor** com foto (arrastar ou escolher).
- **Produto novo**: nome, categoria, textos, ocasiões e a primeira cor com foto. Entra como "Novo".
- **Kit**: nome, descrição, foto, marca e cor da caixa mostradas na foto, se aparece na home, na página de fim de ano e
  em quais tipos de `/kits-corporativos/`; tirar do site, voltar, aprovar kit novo; **kit novo**.

As fotos são preparadas no navegador: lado maior até 1254 px (produtos) ou 1920 px (kits), WebP (PNG no Safari), com
aviso para foto pequena ou não quadrada. Produtos vão para `img/produtos/<id>.webp`; kits, para `img/v2/kit-<slug>-<data>.webp`.

## Regras (as mesmas do build)
A tela valida antes de publicar e bloqueia o que o build recusaria: nome do produto, nome da cor e texto alternativo
obrigatórios; cor `#RRGGBB`; categoria válida; **sem material nem capacidade** em nome, descrição e texto alternativo
enquanto o material não estiver confirmado (`SPEC_RE`); título no Google até 65 caracteres e descrição de 70 a 160;
kits com nome e descrição. As opções vêm do build em `/admin/inventario/opcoes.json` (categorias, ocasiões, a regra de
material e as miniaturas); produtos e kits são lidos do repositório com o login.

## Como a publicação funciona
1. As alterações ficam guardadas no navegador (localStorage) até publicar; fechar a página não perde nada, exceto
   fotos muito grandes (a tela avisa).
2. **Publicar**: a tela lê de novo os arquivos da `main`, aplica as alterações por cima (o que outra pessoa publicou
   no meio-tempo não se perde), valida de novo e cria **um commit** numa branch `inventario/<data-hora>` com um pull
   request, que é juntado na `main` na hora. **Salvar como rascunho** deixa o pull request aberto para revisão; ele
   aparece em Alterações › Rascunhos salvos, com Publicar e Descartar.
3. O push na `main` dispara o GitHub Actions (build + testes); com erro, nada vai ao ar e o motivo fica na aba Actions.
   O Easypanel publica no próximo **Deploy** (automático se o webhook estiver ligado; ver `docs/DEPLOY.md`).

Arquivos que a tela grava: `src/data/produtos.json`, `modelos.json`, `selecoes.json`, `kits.json` (mesmo formato do
`tools/produtos.py`: JSON com recuo 1 e quebra de linha no fim) e as fotos enviadas.

## Kits (`src/data/kits.json`)
Fonte única dos kits (antes eram listas no `build.py`): `kits` (slug, nome, descrição, foto, marca_ficticia, cor_caixa,
foto_anterior, situacao `no_site`/`fora`, novo), `home` e `fim_de_ano` (listas de slugs, na ordem) e `tipos` (âncora,
título, linha e kits de cada seção de `/kits-corporativos/`; o menu aponta para as âncoras). O build valida slugs,
campos obrigatórios e listas (`preparar_kits`).

## Testar no computador (sem GitHub)
Sem o app `admin-api`, em localhost a tela usa o servidor local abaixo.
```
python -I tools/admin_local.py          # grava direto nos arquivos desta pasta (src/data/, img/produtos/, img/v2/)
python build.py && python -m http.server 8215 --directory dist
```
Abra http://127.0.0.1:8215/admin/inventario/. Em localhost a tela usa o servidor local (porta 8081) quando não há
login do GitHub no navegador. Confira com `git diff` e rode o build. Os testes (`tests/e2e.mjs`, seção Inventário)
simulam esse servidor e não gravam nada.

## Arquivos
| Caminho | O que é |
|---|---|
| `src/admin/inventario/` | `index.html`, `inventario.css`, `inventario.js` |
| `blog.py` › `inventario_dados()` | gera `/admin/inventario/opcoes.json` |
| `tools/admin_local.py` | servidor local de teste |
| `deploy/admin-api/` | serviço de login com usuário e senha (Easypanel) |
| `tools/admin_senha.py` | gera a linha de cada usuário e o segredo das sessões |
| `build.py` › `FORA_DO_SITE`, `preparar_kits()` | modelos fora do site e validação dos kits |
