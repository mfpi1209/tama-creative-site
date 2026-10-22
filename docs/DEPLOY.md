# Publicação

## Quem serve o quê

| Endereço | Origem | Situação |
|---|---|---|
| https://tamacreative.com.br | Easypanel (Traefik → container Nginx com o site gerado) | Oficial. |
| https://tamacreative.netlify.app | Netlify (cópia antiga) | Deve só redirecionar (301) para o domínio. Ver "Netlify" abaixo. |
| /api/proposta | Nginx do site → n8n (`tama_n8n:5678/webhook/proposta`) | Ver `docs/PROPOSTAS.md`. |
| /api/admin/ | Nginx do site → app `admin-api` (`tama_admin-api:8080`) | Login com usuário e senha do Inventário. Ver `docs/INVENTARIO.md`. |

## Do commit ao ar

1. Push na `main` dispara `.github/workflows/deploy.yml`:
   gera o site (`python build.py`) → roda `tests/e2e.mjs` → monta a imagem Nginx (`deploy/Dockerfile.static`) →
   testa `nginx -t`, rotas, redirecionamentos e HSTS no container → **só então** atualiza a branch `deploy`
   (site pronto + Dockerfile) e a imagem `ghcr.io/mfpi1209/tama-creative-site`.
2. O Easypanel publica quando alguém clica **Deploy** no app do site, ou automaticamente se o segredo
   `EASYPANEL_DEPLOY_WEBHOOK` existir no GitHub.

Há duas formas de o Easypanel montar o site, e é preciso confirmar no painel qual o app usa:
- **Branch `deploy`** (recomendada: já passou pelas checagens) com o `Dockerfile` que vai nela; ou
- **Branch `main` com o `Dockerfile` da raiz** (gera o site dentro do Easypanel; não passa pelos testes do GitHub).

Ligue o deploy automático (webhook) só depois de confirmar que o app usa a branch `deploy`.

### Checagem depois de publicar

- `curl -sI https://tamacreative.com.br/ | grep -i last-modified` com a data do último commit.
- `/catalogo/`, `/ativacoes-promocionais/`, `/hotelaria-e-gastronomia/` → 200.
- `/brindes/`, `/branding-identidade-visual/`, `/projetos/` → 301.
- `robots.txt` sem `/brindes/sitemap.xml`; `sitemap.xml` sem branding e projetos.
- Um pedido de teste combinado (ver `docs/PROPOSTAS.md`).

## Build local e testes

```bash
pip install -r requirements.txt
python build.py                                   # gera dist/
python -m http.server 8099 --directory dist        # em outro terminal
npm i --no-save puppeteer-core@25.12.0             # uma vez
EDGE_PATH="/caminho/do/Chrome" node tests/e2e.mjs http://127.0.0.1:8099
```

O build falha se encontrar placeholders (`[WhatsApp]` etc.) no HTML ou dado inválido no catálogo.

## Configuração (`site.config.json` ou variável de ambiente com o nome em maiúsculas)

| Chave | Uso |
|---|---|
| `site_url` | Canonical, sitemap, Open Graph |
| `whatsapp` | Botões e link wa.me (só dígitos, com DDI) |
| `email`, `instagram` | Rodapé, contato, `sameAs` |
| `razao_social`, `cnpj`, `cidade`, `responsavel_comercial` | Rodapé, Sobre e Privacidade. Vazio = não aparece. Só dados confirmados pela TaMa. |
| `ga4_id` | Ativa o GA4 com banner de consentimento (ver `docs/MEDICAO.md`) |
| `form_endpoint` | `/api/proposta` |
| `mockups_marca` | Imagens com a marca TaMa aplicada como exemplo |

Nada aqui é segredo. Credenciais (SMTP, n8n) ficam só no n8n.

## Nginx (`deploy/nginx.conf`)

- IP real do visitante a partir do `X-Forwarded-For` do Traefik (sem isso o limite de envios do formulário valeria
  para todos os visitantes juntos).
- `/api/proposta`: só POST, 6 por minuto por IP (+3 de folga), corpo até 64 KB, 20 s de espera pelo n8n.
- Redirecionamentos permanentes das URLs antigas (`/brindes/`, `/branding…`, `/projetos…`, atalhos).
- HSTS, CSP e demais cabeçalhos em `deploy/security-headers.conf`; editor `/admin/` com `deploy/admin-headers.conf`.
- `/img/produtos/` (originais do catálogo, usados pelo editor) com `X-Robots-Tag: noindex`.

## Netlify

O `netlify.toml` publica só `netlify/redirecionar/` (301 de tudo para o domínio). Se o site do Netlify ainda estiver
ligado ao repositório, o próximo build na `main` aplica isso sozinho. Se não estiver, quem tem a conta roda uma vez:

```bash
netlify deploy --prod --dir netlify/redirecionar
```

Depois, conferir que `https://tamacreative.netlify.app/solicitar-proposta/` responde 301 e, no painel do Netlify,
exportar e apagar os envios antigos de Forms (se houver pedidos ali, repassá-los à TaMa antes).
