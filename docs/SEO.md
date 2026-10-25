# SEO — TaMa Creative

## Títulos, descriptions e H1 por URL

Valores de `build.py` (chaves `title` e `description` de cada `page_*`) e de `blog.py`, em 17/10/2026. Se alguém
ajustar um title no código, o código vale; atualize esta tabela.

| URL | Title (car.) | Description (car.) | Robots | H1 |
|---|---|---|---|---|
| `/` | TaMa Creative \| Brindes, confecções, kits e ativações (53) | Brindes corporativos, uniformes, kits e ativações promocionais com a marca da sua empresa. A TaMa cria e coordena da escolha das peças à entrega. (145) | index | Brindes, confecções e ativações para dar presença à sua marca. (1º slide da abertura) |
| `/catalogo/` | Catálogo: 52 modelos de brindes e confecções \| TaMa Creative (60) | 52 modelos para personalizar com a sua marca: vestuário, canetas, bolsas, embalagens, garrafas, acessórios e casa. Monte sua seleção e peça uma proposta. (153) | index | 52 modelos para a sua marca |
| `/brindes-corporativos/` | Brindes corporativos personalizados para empresas \| TaMa Creative (65) | Brindes personalizados para empresas com curadoria de materiais e acabamento premium: presentes para clientes, colaboradores e eventos. Peça uma proposta. (154) | index | Brindes corporativos personalizados, escolhidos para serem usados |
| `/kits-corporativos/` | Kits corporativos personalizados: boas-vindas e eventos \| TaMa (62) | Kits onboarding, kits para eventos e presentes para clientes, montados com curadoria, embalagem própria e a identidade da sua empresa. Solicite uma proposta. (157) | index | Kits corporativos personalizados para cada momento |
| `/brindes-por-ocasiao/` | Brindes e presentes corporativos por ocasião \| TaMa Creative (60) | Ideias de brindes e presentes corporativos para boas-vindas, eventos, fim de ano, reconhecimento e lançamentos, com a marca da sua empresa. Monte a seleção. (156) | index | Brindes e presentes corporativos por ocasião |
| `/confeccoes-personalizadas/` | Uniformes corporativos e confecções personalizadas \| TaMa Creative (66) | Uniformes corporativos, polos bordadas, moletons e bonés para equipes e eventos, alinhados à identidade visual da sua empresa e pensados para quem veste. (153) | index | Uniformes corporativos e confecções personalizadas (1º slide) |
| `/ativacoes-promocionais-eventos-corporativos/` | Ativações promocionais para eventos corporativos \| TaMa Creative (64) | Ativações promocionais para eventos corporativos: degustações, feiras, buffet e decoração, com uniformes e brindes da sua marca. Peça uma proposta. (147) | index | Ativações promocionais e degustações para a sua marca |
| `/hotelaria-e-gastronomia/` | Cardápios, porta-contas e uniformes para restaurantes \| TaMa (60) | Cardápios, porta-contas, jogos americanos, dólmãs e aventais com a marca do seu restaurante, bar, café ou hotel. Monte a seleção e peça uma proposta. (149) | index | Produtos personalizados para restaurantes, bares e hotéis |
| `/sobre/` | Sobre a TaMa Creative \| Brindes, confecções, kits e ativações (61) | A TaMa Creative desenvolve e coordena brindes, confecções, kits personalizados e ativações promocionais para empresas, com visão de Trade Marketing. (148) | index | Quem é a TaMa Creative |
| `/solicitar-proposta/` | Solicitar proposta de brindes, kits e confecções \| TaMa (55) | Peça uma proposta de brindes corporativos, kits ou uniformes. Conte a ocasião e a TaMa Creative propõe as possibilidades. (121) | index | Vamos dar forma à sua ideia? |
| `/privacidade/` | Política de privacidade \| TaMa Creative (39) | Como a TaMa Creative trata os dados enviados pelo formulário de proposta, conforme a Lei Geral de Proteção de Dados (LGPD). (123) | index | Política de privacidade |
| `/blog/` | Blog: guias de brindes corporativos e kits \| TaMa Creative (58) | Guias da TaMa Creative sobre brindes corporativos, kits e presentes de empresa… (151) | index | Guias para presentear em nome da sua marca |
| `/blog/brindes-de-fim-de-ano-para-clientes/` | Brindes de fim de ano para clientes: como escolher bem \| TaMa (61) | (158) | index | Título do artigo |
| `/blog/presente-de-natal-para-funcionarios/` | Presente de Natal para funcionários: ideias além da cesta \| TaMa (64) | (147) | index | Título do artigo |
| `/blog/o-que-colocar-no-kit-de-boas-vindas/` | O que colocar no kit de boas-vindas (inclusive remoto) \| TaMa (61) | (153) | index | Título do artigo |
| `/blog/brindes-e-compliance-politica-de-presentes/` | Política de brindes e presentes: limites e compliance \| TaMa (60) | (159) | index | Título do artigo |
| `/obrigado/`, `/404.html` | — | — | **noindex** | — |

O número de modelos no title, na description e no H1 do `/catalogo/` vem do catálogo (`len(CATALOGO)`) e muda
sozinho quando entram ou saem modelos.

**Fora do site:** `/branding-identidade-visual/` e `/branding` redirecionam (301) para `/`; `/projetos/` e as páginas
de projetos redirecionam para `/sobre/`. A TaMa não oferece branding, e não há projetos publicados. Essas URLs não
estão no sitemap.

Canonical absoluto em `https://tamacreative.com.br/...` (configurável por `SITE_URL`). Sitemap só com as páginas
indexáveis. As URLs filtradas (`?categoria=`, `?ocasiao=`) mantêm o canonical da página sem parâmetros, então não
geram conteúdo duplicado.

## Mapa de intenção de busca

**Não há dados de volume de busca, dificuldade ou CPC.** As consultas abaixo são exemplos do que cada tipo de
visitante provavelmente procura, não termos validados. Antes de priorizar, conferir no Google Keyword Planner e,
depois de alguns meses no ar, nas consultas reais do Search Console.

| Intenção | Exemplos de consulta (hipóteses) | Página principal | Páginas de apoio |
|---|---|---|---|
| Brindes corporativos e personalizados | brindes corporativos personalizados; brindes personalizados para empresas | `/brindes-corporativos/` (o serviço) | `/catalogo/` (os modelos, para quem já quer ver peças) |
| Kits corporativos e presentes premium | kit corporativo personalizado; kit de boas-vindas para colaboradores; presente corporativo premium | `/kits-corporativos/` | `/brindes-por-ocasiao/` (ideias por ocasião); artigos de boas-vindas e Natal |
| Confecções e uniformes | uniformes corporativos personalizados; camisa polo bordada para empresa | `/confeccoes-personalizadas/` | `/catalogo/` (vestuário) |
| Restaurantes e hotéis | cardápio personalizado para restaurante; porta-contas personalizado; dólmã com logo | `/hotelaria-e-gastronomia/` | `/catalogo/` (hotelaria e gastronomia) |
| Ativações e degustações | ativação promocional; degustação em supermercado; ação promocional no ponto de venda | `/ativacoes-promocionais-eventos-corporativos/` | `/confeccoes-personalizadas/` (uniformes da equipe) |
| Marca | TaMa Creative | `/` | `/sobre/` |
| Pedido | orçamento de brindes corporativos; orçamento de kit corporativo | `/solicitar-proposta/` | — |

### Disputas a evitar

Três páginas falam de brindes. Cada uma tem um papel; não deixe duas mirarem a mesma consulta:

| Página | Papel | Não usar no title/H1 |
|---|---|---|
| `/brindes-corporativos/` | Página do **serviço**: o que é, como funciona, para quem. Alvo de "brindes corporativos personalizados". | Lista de modelos ou "catálogo" |
| `/catalogo/` | **Navegação de modelos** (52 modelos, cores, seleção). Alvo de buscas por peça ("caneca personalizada", "ecobag personalizada"), não do termo genérico. | "Brindes corporativos personalizados" como termo principal |
| `/brindes-por-ocasiao/` | **Ideias por ocasião** (boas-vindas, fim de ano, reconhecimento…), uma seleção editorial sobre o catálogo. Alvo de buscas com ocasião. | "Premium" e o termo genérico de brindes |

O endereço `/brindes-por-ocasiao/` foi mantido (links antigos e do blog), mas o termo "presentes premium"
passou para `/kits-corporativos/`. Se um dia a página de ocasiões mudar de endereço, é preciso redirecionar (301) a
URL antiga e atualizar os links do blog.

Regra geral: links internos com texto descritivo apontando para a página principal da intenção (ex.: "brindes
corporativos" → `/brindes-corporativos/`, "ver os modelos" → `/catalogo/`).

## Papel do blog

O blog atrai quem ainda está pesquisando e leva essa pessoa às páginas comerciais. Cada artigo gera estes links
(ver `docs/BLOG.md`):

- Botão do serviço no quadro do autor (`servico` do artigo): hoje `/kits-corporativos/` (boas-vindas e Natal),
  `/brindes-corporativos/` (compliance) e `/brindes-por-ocasiao/` (fim de ano).
- Peças do catálogo no fim do artigo, com "+ Selecionar", e o link "Ver todas as ideias para…" para
  `/brindes-por-ocasiao/?ocasiao=…` (ou "Ver o catálogo completo" → `/catalogo/` quando o artigo não tem
  ocasião).
- Chamada para a proposta com o tipo já escolhido no formulário.
- Links no texto para outros artigos e páginas de serviço.

Na data table de pedidos, `primeira_pagina` começando com `/blog/` mostra quantos pedidos começaram no blog
(ver `docs/MEDICAO.md`).

## Estratégia editorial (prioridade por sazonalidade)

| # | Guia | Consulta-alvo (hipótese) | Página de destino do link | Situação |
|---|---|---|---|---|
| 1 | Brindes de fim de ano para clientes: como escolher sem parecer propaganda | brindes de fim de ano para clientes | Ideias por ocasião (fim de ano) | Publicado |
| 2 | Presente de Natal para funcionários: ideias além da cesta | presente de natal para funcionários | Kits corporativos | Publicado |
| 3 | O que colocar no kit de boas-vindas (inclusive remoto) | o que colocar no kit de boas-vindas | Kits corporativos | Publicado |
| 4 | Kit para evento corporativo: o que colocar por tipo de evento | kit para evento corporativo o que colocar | Kits corporativos | Em espera (o subdomínio de brindes populares planeja `/kits-para-eventos/`) |
| 5 | Brindes e compliance: limites de valor e política de presentes | política de brindes e presentes | Brindes corporativos | Publicado |
| 6 | Brindes sustentáveis de verdade: materiais e como evitar greenwashing | brindes sustentáveis para empresas | Brindes corporativos | A escrever; depende de materiais confirmados pelo fornecedor |
| 7 | Uniforme corporativo: tecido, modelagem e bordado x silk | como escolher uniforme corporativo | Confecções | A escrever |

O antigo tema "quanto custa uma identidade visual" saiu da lista: a TaMa não oferece branding. Cada guia precisa de
conteúdo original e útil; não produzir páginas genéricas em massa. Títulos, descriptions, estrutura e o passo a passo
de publicação estão em `docs/BLOG.md`. Depois de publicar: pedir indexação dos guias 1 e 2 no Search Console e
acompanhar consultas e CTR por artigo.

## Checklist — Search Console e Analytics

**Quando o domínio estiver no ar**
- [ ] Confirmar `https://tamacreative.com.br` com cadeado e `www` redirecionando para o domínio sem www.
- [ ] Conferir que `tamacreative.netlify.app` responde 301 para o domínio (ver `docs/DEPLOY.md` › Netlify).
- [ ] Search Console: adicionar a propriedade de **domínio** `tamacreative.com.br` (verificação por registro TXT no
      DNS do domínio). Pendente: depende de acesso da TaMa.
- [ ] Enviar `https://tamacreative.com.br/sitemap.xml`.
- [ ] Inspecionar e pedir indexação de `/`, `/catalogo/`, `/brindes-corporativos/`, `/kits-corporativos/`,
      `/ativacoes-promocionais-eventos-corporativos/` e `/hotelaria-e-gastronomia/`.
- [ ] Em Indexação › Páginas, conferir que `/obrigado/` e `/404.html` aparecem como "excluídas por noindex" e que
      `/branding-identidade-visual/` e `/projetos/` aparecem como "página com redirecionamento" (esperado).
- [ ] Testar uma página no Teste de Pesquisa Aprimorada (dados estruturados: Organization, BreadcrumbList).

**Analytics (GA4)**: ativação, eventos e conversões em `docs/MEDICAO.md`. Resumo: criar a propriedade, preencher
`ga4_id`, publicar e marcar só `proposta_gravada` como conversão principal (`whatsapp_click` no máximo como
micro-conversão: clique não é venda).

**Contínuo**
- [ ] Mensal: Core Web Vitals (campo) no Search Console; consultas e CTR por página; conferir se alguma consulta
      aparece em duas páginas que disputam entre si (ver "Disputas a evitar").
- [ ] A cada nova página: title e description únicos, um H1, links internos para a página de serviço correspondente.
