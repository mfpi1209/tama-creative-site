# Equipe de agentes do site

Os "funcionários" que trabalham no site da TaMa Creative são subagentes do Claude Code. Cada um tem uma
especificação em `.claude/agents/<nome>.md`: missão, quando acionar, entradas, entregáveis, checklist de qualidade,
limites e para quem passa o trabalho. O Claude Code lê essa pasta sozinho; para ver ou editar, use `/agents`.

Para acionar um agente, peça pelo nome ("use o `qa-links-acessibilidade` na branch onda-3") ou deixe o Claude Code
escolher pela descrição. Para coordenar uma onda inteira, abra a sessão com o coordenador como agente principal:
`claude --agent coordenador-projeto` (subagentes não acionam outros subagentes; o agente principal, sim).

## Funções

| Função | Arquivo | Quando acionar | Principais entregáveis | Modelo | Edita? |
|---|---|---|---|---|---|
| Diretor de estratégia | `.claude/agents/diretor-estrategia.md` | Início de uma entrega; dúvida de rumo, de papel de página ou de como dar prova sem inventar | Diagnóstico, mensagem por página, plano em ondas P0 a P3 com dono e arquivos, dependências da TaMa | opus | Não |
| Arquiteto de UX e navegação | `.claude/agents/arquiteto-ux-navegacao.md` | Página nova ou renomeada; mudança de menu, rodapé ou submenu; problema no celular | Mapa de páginas, menu e submenus, trilhas, órfãs e becos sem saída, medição de toque, especificação para o front | sonnet | Não |
| Editor de SEO e conteúdo | `.claude/agents/editor-seo-conteudo.md` | Página nova; revisão de SEO; build recusou texto; afirmação sem confirmação | Tabela de titles (≤ 60), descriptions (≤ 160) e H1; reescritas seguras; `docs/SEO.md` atualizado | sonnet | Sim |
| Redator do blog | `.claude/agents/redator-blog.md` | Nova pauta; atualização de artigo; revisão de fontes | Artigo em `src/blog/`, front matter válido, fontes com status 200 e data, links para serviço e proposta | sonnet | Sim |
| Curador do catálogo e das imagens | `.claude/agents/curador-catalogo-imagens.md` | Produto, cor, vista ou cena nova; logo errado; alt recusado; mudança de seleção | Custo estimado antes, folha de contato, entradas no banco, `verificar` sem erro, lista para o dono aprovar | sonnet | Sim |
| Curador de brindes de tecnologia | `.claude/agents/curador-tecnologia.md` | Peça tech nova (pen drive, power bank, fone, caixa de som, estojo de tecnologia, carregador, hub, suporte, mouse pad); logo em peça pequena; texto que cite GB, mAh, W ou bluetooth | Ficha por modelo (nome neutro, id, cores, área da logo, prompt), especificação da categoria `tecnologia`, custo estimado, pendências de especificação | sonnet | Sim (só `docs/PLANO-TECNOLOGIA.md`) |
| Dev front-end e build | `.claude/agents/dev-front-build.md` | Implementar especificações; bug de página, filtro, menu ou estilo; e2e quebrado | Diff pontual, build e e2e verdes com e sem temporada, testes atualizados | sonnet | Sim |
| QA de links e acessibilidade | `.claude/agents/qa-links-acessibilidade.md` | Antes e depois de juntar as branches; antes do push; depois do Deploy | Placar (e2e, axe, links), falhas com gravidade e dono, tabela de 301 e sitemap, veredito | sonnet | Não |
| DevOps e publicação | `.claude/agents/devops-publicacao.md` | 301, cabeçalho, CSP; CI vermelho; login do `/admin/`; formulário; hora de publicar | Diff de infraestrutura com `check` no CI, `nginx -t`, roteiro de publicação e checagem em produção | sonnet | Sim |
| Coordenador do projeto | `.claude/agents/coordenador-projeto.md` | Qualquer entrega com mais de um agente; juntar e publicar | Plano de distribuição por arquivo, branch de integração, provas, resumo para o OK do dono | opus | Sim (junções) |

## Posse dos arquivos

Cada arquivo tem **um dono por onda**. Quem não é dono entrega a mudança como especificação para o dono aplicar. O
coordenador pode trocar a posse de uma onda para outra (por exemplo, dar `build.py` ao editor de SEO numa onda só de
textos).

| Arquivos | Dono padrão |
|---|---|
| `build.py`, `blog.py`, `src/site.js`, `src/styles.css`, `src/blog.css`, `src/admin/`, `tests/e2e.mjs`, `requirements.txt` | `dev-front-build` |
| `src/data/produtos.json`, `selecoes.json`, `plano-cores.json`, `mockups.json`, `img/produtos/`, `img/marca/`, `midia/` (local), `docs/BANCO-IMAGENS.md`, `docs/AUDITORIA-IMAGENS.md` | `curador-catalogo-imagens` |
| `src/data/modelos.json` | `curador-catalogo-imagens` (o editor de SEO revisa os textos pela especificação ou com a posse da onda) |
| `docs/PLANO-TECNOLOGIA.md` | `curador-tecnologia` (o que ele especifica para dados, build e testes é aplicado pelos donos acima) |
| `src/blog/*.md`, `img/blog/`, tabela de artigos em `docs/BLOG.md` | `redator-blog` |
| `docs/SEO.md` | `editor-seo-conteudo` |
| `.github/workflows/`, `deploy/`, `Dockerfile`, `.dockerignore`, `netlify.toml`, `netlify/`, `docs/DEPLOY.md`, `docs/PROPOSTAS.md` | `devops-publicacao` |
| `README.md`, `docs/PENDENCIAS.md`, `docs/EQUIPE.md`, `.claude/agents/`, `site.config.json` | `coordenador-projeto` (dados de `site.config.json` só com confirmação da TaMa) |
| Nenhum (só leitura) | `diretor-estrategia`, `arquiteto-ux-navegacao`, `qa-links-acessibilidade` |

## Portas para rodar em paralelo

Cada agente trabalha na própria worktree (o build apaga e recria `dist/`) e usa a sua porta para servir o site e o
seu `E2E_PORT` para o Chrome do teste (o padrão, 9335, colide se dois rodarem juntos).

| Agente | Porta do site | `E2E_PORT` |
|---|---|---|
| `coordenador-projeto` | 8099 | 9335 |
| `dev-front-build` | 8101 | 9341 |
| `qa-links-acessibilidade` | 8102 | 9342 |
| `curador-catalogo-imagens` | 8103 | 9343 |
| `editor-seo-conteudo` | 8104 | 9344 |
| `redator-blog` | 8105 | 9345 |
| `arquiteto-ux-navegacao` | 8106 | 9346 |
| `devops-publicacao` | 8107 (Docker: 8080) | 9347 |

## Fluxo típico de uma entrega

```
diagnóstico → plano em ondas → execução em paralelo por arquivo → QA → push com OK → Deploy no Easypanel
```

1. **Diagnóstico** (`diretor-estrategia`, com o `arquiteto-ux-navegacao` e o `qa-links-acessibilidade` quando o
   problema é de navegação ou técnico): o que está bom, o que confunde, o que falta, com evidência.
2. **Plano em ondas** (`diretor-estrategia` → `coordenador-projeto`): itens P0 a P3, cada um com dono, arquivos e
   critério de pronto. O coordenador transforma em plano de distribuição, sem arquivo repetido na mesma rodada, e cria
   uma branch e uma worktree por agente a partir da `origin/main`.
3. **Execução em paralelo por arquivo**: cada agente trabalha só nos seus arquivos, roda build e e2e nos dois modos
   da temporada e faz commit na própria branch. Chamadas pagas à OpenAI só depois do custo estimado e do OK do dono.
4. **QA**: o coordenador junta as branches numa branch de integração, junta a `origin/main`, roda build e e2e com e
   sem `TEMPORADA=off`, e o `qa-links-acessibilidade` faz a varredura. Falhas voltam ao dono de cada arquivo até não
   restar P0 nem P1.
5. **Push com OK**: o coordenador entrega o resumo ao dono (o que muda, provas, custos, pendências) e só com o OK
   explícito faz o push na `main`, sem force. O GitHub Actions gera, testa e atualiza a branch `deploy`.
6. **Deploy no Easypanel**: o dono clica em **Deploy** no app do site; o `devops-publicacao` e o QA conferem a
   produção (`docs/DEPLOY.md` › Checagem depois de publicar).

### Passagem de bastão: linha de tecnologia

```
curador-tecnologia → OK do dono (linha e custo) → curador-catalogo-imagens + dev-front-build → editor-seo-conteudo → QA
```

1. O `curador-tecnologia` mantém `docs/PLANO-TECNOLOGIA.md`: modelos, ids, cores, onde vai a logo, prompts, ocasiões,
   kits, custo estimado e o que falta confirmar (capacidade, potência, bateria, certificações).
2. O dono aprova a linha e o custo. Sem esse OK, nada é gerado.
3. Em paralelo: o `dev-front-build` cria a categoria `tecnologia` (build, `tools/produtos.py`, atalho e e2e) e o
   `curador-catalogo-imagens` gera, confere na folha de contato e importa as fotos, com ocasiões e `foto_base`.
4. O `editor-seo-conteudo` revisa resumos, "ideal para" e o texto da categoria; o QA confere filtros, páginas de
   modelo e alts. As especificações seguem "a confirmar na proposta" até a TaMa confirmar com o fornecedor.

## Regras que valem para todos

- **Negócio**: a TaMa Creative atende empresas com brindes corporativos, uniformes e confecções, kits corporativos,
  ativações promocionais e itens de hotelaria e gastronomia. Não fabrica: seleciona fornecedores, personaliza e
  coordena a produção. Tom elegante, objetivo e humano.
- **Nada inventado**: sem clientes, cases, números, preços, prazos ou estoque. Imagens sempre "ilustrativas". Material
  e técnica "a confirmar" até a TaMa confirmar. Sem marcas de terceiros nas imagens (Duracril, Brahma, Coca-Cola,
  Apple etc.); nas cenas, só a TaMa ou marcas fictícias (Casa Mirelo, Nexo, Vera, Elo, Solar, Oliva).
- **Glossário**: Brindes corporativos, Uniformes e confecções, Kits corporativos, Ativações promocionais para eventos corporativos, Hotelaria e
  gastronomia. Página de ocasiões: "Brindes por ocasião", em `/brindes-por-ocasiao/`. Temporada em
  `site.config.json › temporada` (fim de ano de 1/10 a 31/12); `TEMPORADA=off` desliga.
- **Segredos**: a chave da OpenAI fica só em `~/.config/tama/openai.env`, nunca no chat nem no repositório.
- **Git**: branch ou worktree própria; juntar a `origin/main` antes de subir; nunca force push; push na `main` só com
  o OK explícito do dono; publicação pelo GitHub Actions (`deploy.yml`) e depois o Deploy manual no Easypanel.
- **Comandos**:
  - build: `~/Projetos/tama-creative-site/.venv/bin/python build.py` (sem temporada: `TEMPORADA=off` antes);
  - ferramentas com Pillow: `~/Projetos/tama-brindes/.venv/bin/python -I tools/<script>.py`;
  - e2e: `ln -sfn ~/Projetos/tama-brindes/node_modules node_modules; EDGE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node tests/e2e.mjs http://127.0.0.1:<porta>; rm node_modules`,
    com e sem `TEMPORADA=off`.
- **Nunca** enviar formulários reais nem disparar mensagens.
