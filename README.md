# Site TaMa Creative

Site estático multipágina de https://tamacreative.com.br (hoje servido em https://tamacreative.netlify.app).

- Gerar: `pip install -r requirements.txt` e `python build.py` → `dist/`
- Publicar: `netlify deploy --no-build --prod --dir dist --functions netlify/functions`
- Testar: ver `docs/DEPLOY.md` › Testes

Documentação:
- `docs/RELATORIO.md` — diagnóstico, antes/depois, mudanças, arquitetura, decisões
- `docs/SEO.md` — títulos e descriptions, mapa de palavras-chave, plano editorial, checklist Search Console/GA4
- `docs/DEPLOY.md` — configuração, variáveis de ambiente, n8n, domínio, testes
- `docs/BLOG.md` — blog (/blog/): estrutura, passo a passo para publicar artigos, regras editoriais
- `docs/PENDENCIAS.md` — informações e fotos que faltam
- `docs/PLANO-REFATORACAO.md` — plano a partir da análise do creativedesign.com.br

`prototipo/` guarda o protótipo anterior (página única), apenas como histórico.
