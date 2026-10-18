# Site TaMa Creative

Site estático multipágina de https://tamacreative.com.br, servido pelo Easypanel (container Nginx). O formulário de
proposta envia para `/api/proposta`, que o Nginx repassa ao n8n. O endereço antigo `tamacreative.netlify.app` só
redireciona para o domínio.

## Gerar, testar e publicar

- **Gerar:** `pip install -r requirements.txt` e `python build.py` → `dist/`. O build falha com placeholder no HTML,
  dado inválido no catálogo ou material afirmado sem confirmação.
- **Testar:** servir `dist/` localmente e rodar `tests/e2e.mjs` (comandos em `docs/DEPLOY.md` › Build local e testes).
- **Publicar:** push na `main`. O GitHub Actions gera o site, roda os testes, testa a imagem Nginx e atualiza a branch
  `deploy`; o Easypanel publica a partir dela. Detalhes, checagem depois de publicar e configuração em
  `docs/DEPLOY.md`.

Conteúdo do catálogo e do blog também pode ser editado em `/admin/` (ver `docs/BANCO-IMAGENS.md` e `docs/BLOG.md`).

## Documentação

- `docs/DEPLOY.md` — publicação (GitHub Actions, branch `deploy`, Easypanel), Nginx, configuração, testes, Netlify
  (só redirecionamento)
- `docs/PROPOSTAS.md` — formulário de proposta: contrato com o n8n, workflows, data table `tama_propostas` e o que
  falta validar em produção
- `docs/MEDICAO.md` — eventos de medição, conversões no GA4, origem dos pedidos e funil de status
- `docs/SEO.md` — titles, descriptions e H1, mapa de intenção de busca, papel do blog, checklist do Search Console
- `docs/BANCO-IMAGENS.md` — catálogo de produtos (`produtos.json` e `selecoes.json`), fotos, regra de material não
  confirmado, editor
- `docs/BLOG.md` — blog (`/blog/`): estrutura, passo a passo para publicar artigos, regras editoriais
  (modelo em `docs/blog-modelo.md`)
- `docs/PENDENCIAS.md` — o que depende da TaMa (acessos, dados, confirmações, fotos)
- `docs/BRIEFING-MOCKUPS.md` — mockups com a marca TaMa aplicada como exemplo (briefing e uso no site)
- `docs/RELATORIO.md` e `docs/PLANO-REFATORACAO.md` — histórico (diagnóstico e plano das versões anteriores)

`prototipo/` guarda o protótipo anterior (página única), apenas como histórico.
