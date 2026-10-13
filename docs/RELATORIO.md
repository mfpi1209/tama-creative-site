# TaMa Creative — evolução do site (outubro/2026)

Site em produção: https://tamacreative.netlify.app (domínio definitivo tamacreative.com.br configurado no Netlify, aguardando a troca de servidores DNS no Registro.br).

> **Atualização v2 (12/10/2026):** o visual da versão 2 foi aplicado sobre esta base. As seções 1 a 6 descrevem a evolução anterior; a seção 7 descreve a v2 e as medições novas.

## 1. Diagnóstico do site original (antes)

Medições reais feitas em 12/10/2026 sobre a versão publicada, com Lighthouse 13.5 (laboratório, Edge headless), axe-core 4.13 e verificação de layout em 1440, 1024, 768, 390 e 320 px.

| Categoria | Nota (0–10) | Evidência |
|---|---|---|
| Design e identidade | 8 | Sistema de marca forte (arco, paleta, tipografia); algumas seções conceituais demais |
| Tipografia | 8 | Par Playfair + Jost bem aplicado; fontes carregadas do Google bloqueando a renderização |
| Hierarquia da informação | 6 | Primeira dobra emocional, sem dizer claramente o que a TaMa vende |
| Experiência desktop/tablet/mobile | 8 | Sem rolagem horizontal em nenhuma largura; menu mobile sem nome acessível |
| Navegação e arquitetura | 4 | Uma única página com rotas por `#`; sem URLs próprias por serviço |
| Clareza da proposta de valor | 6 | Manifesto forte, pouca objetividade comercial |
| Curadoria | 6 | 21 peças boas, apresentadas como lista de texto sem materiais, ocasiões ou ação |
| Credibilidade | 4 | Nenhum projeto apresentado; contatos como placeholder (`[WhatsApp]`) |
| CTAs | 7 | Presentes, mas todos iguais e sem rastreamento |
| Formulário | 6 | Enviava via Netlify Forms, sem validação por campo, sem LGPD, sem antispam |
| Acessibilidade | 9 | Lighthouse 95 (mobile): botão de menu sem nome; axe: ordem de títulos |
| Desempenho | 7 | Lighthouse mobile 72 · LCP 6,1 s · FCP 3,1 s · fontes bloqueando 1,8 s · imagens 434 KiB acima do necessário |
| SEO técnico | 3 | 7 H1 no mesmo HTML, canonical único, sem dados estruturados, title só mudava via JS |
| Geração de leads | 5 | Sem rastreamento de eventos, sem integração com CRM/n8n |
| Código e manutenção | 3 | Código-fonte fora da pasta do projeto, sem testes, sem configuração por ambiente |

### Matriz de problemas

| Problema | Evidência | Impacto | Prioridade | Solução |
|---|---|---|---|---|
| Página única com rotas `#` | Um só HTML com 7 H1 e um canonical | Google não indexa serviços separadamente | P0 | Site estático multipágina com URLs semânticas |
| Placeholders de contato públicos | `[WhatsApp]`, `[e-mail]` visíveis | Perda de confiança | P0 | Contatos só aparecem quando configurados |
| Código-fonte fora do projeto | Gerador estava em pasta temporária | Risco de perder o site | P0 | `tama-site/` com `build.py`, `src/`, testes e docs |
| LCP 6,1 s no celular | Lighthouse | Abandono e ranking | P0 | Fontes no próprio domínio, AVIF/WebP com `srcset`, imagem LCP pré-carregada |
| Sem dados estruturados | Nenhum JSON-LD | Menos entendimento pelo Google | P1 | Organization, WebSite, WebPage, Service, BreadcrumbList, ItemList, CreativeWork |
| Formulário sem validação e LGPD | Inspeção | Leads ruins, risco legal | P1 | Validação por campo, consentimento, honeypot, falha tratada |
| Sem integração n8n | — | Pedidos fora do fluxo comercial | P1 | Função `submission-created` com variável de ambiente |
| Sem eventos de analytics | — | Sem medição de conversão | P1 | `dataLayer` com 8 eventos; GA4 opcional com consentimento |
| Curadoria só em texto | Inspeção | Pouco desejo, sem ação | P1 | Fichas com materiais, técnicas, ocasiões, filtros e seleção para a proposta |
| Nenhuma prova de trabalho | — | Credibilidade | P1 | Página de projetos + caso real (identidade TaMa) |
| Botão de menu sem nome | Lighthouse `button-name` | Leitores de tela | P1 | `aria-label` dinâmico |
| Selo "Powered by Netlify" | Script injetado | Aparência amadora | P2 | Desativado nas configurações do site |

## 2. Resultado (depois)

### Medições em produção (Lighthouse, laboratório)

| Página | Celular (Perf · A11y · BP · SEO) | LCP celular | Desktop |
|---|---|---|---|
| Início — antes | 72 · 95 · 100 · 100 | 6,1 s | 96 · 100 · 100 · 100 |
| Início — depois | 97 · 100 · 100 · 100 | 1,7 s | 100 · 100 · 100 · 100 |
| Curadoria premium | 100 · 100 · 100 · 100 | 1,3 s | 100 · 100 · 100 · 100 |
| Kits corporativos | 100 · 100 · 100 · 100 | 1,5 s | 100 · 100 · 100 · 100 |
| Solicitar proposta | 100 · 100 · 100 · 100 | 1,7 s | 100 · 100 · 100 · 100 |

CLS ≤ 0,002 em todas. Estas são métricas de laboratório; os Core Web Vitals de campo (p75 de usuários reais) só existirão no Search Console/CrUX depois que o site tiver tráfego.

### Outras verificações executadas
- 12 páginas × 5 larguras (1440, 1024, 768, 390, 320): nenhuma rolagem horizontal.
- axe-core (WCAG 2.0/2.1/2.2 A e AA + boas práticas): 0 violações após a correção da ordem de títulos.
- Console do navegador: sem erros em nenhuma página.
- Testes de fluxo (`tests/e2e.mjs`): 34/34 aprovados — links internos, menu mobile e Esc, redirecionamento dos links antigos, filtros da curadoria, seleção de peças, pré-preenchimento do formulário, validação, falha do servidor (nunca mostra sucesso), nova tentativa, sucesso, limpeza da seleção e eventos de analytics. O envio é interceptado no teste; nenhum pedido falso foi enviado à produção.
- Netlify: formulário `proposta` reconhecido com os 11 campos; aviso por e-mail para tatydalves@gmail.com mantido; função `submission-created` publicada; redirecionamentos 301 e página 404 funcionando; cabeçalhos de segurança (CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy) ativos.

## 3. O que mudou

**Mantido:** identidade (arco, paleta ameixa/coral/rosé/creme, Playfair + Jost), manifesto, método em 4 etapas, curadoria de 21 peças, mockups.

**Aprimorado:**
- Primeira dobra responde o que é a TaMa, o que oferece, por que é diferente e como pedir proposta (H1 descritivo, três provas curtas, dois CTAs).
- Narrativa da home: proposta de valor → três frentes → projeto e curadoria → ocasiões → diferenciais → método → CTA.
- Curadoria virou vitrine: cada peça tem categoria, materiais, personalização, ocasiões e botão "Adicionar à proposta"; filtros por categoria e por ocasião; barra de seleção que leva as peças para o formulário.
- Formulário com tipo de projeto, campos que aparecem conforme o tipo, validação por campo, consentimento LGPD, honeypot e estados de sucesso e falha reais.

**Criado:** páginas de Brindes corporativos, Kits corporativos, Curadoria premium, Confecções, Branding, Projetos, caso "Identidade TaMa Creative", Sobre, Solicitar proposta, Obrigado, Privacidade e 404; FAQ por serviço; dados estruturados; sitemap; robots; redirecionamentos; função n8n; testes; documentação.

**Removido:** rotas por `#` (com redirecionamento automático dos links antigos), seção "O efeito" como bloco isolado (absorvida pelo manifesto), placeholders de contato, selo do Netlify.

## 4. Arquitetura de páginas

```
/                                     Início
/brindes-corporativos/                Serviço: brindes
/kits-corporativos/                   Serviço: kits
/brindes-corporativos-premium/        Curadoria (38 itens: 21 peças com foto + 17 além do óbvio; filtros, cores, seleção)
/confeccoes-personalizadas/           Serviço: confecções e uniformes
/branding-identidade-visual/          Serviço: branding
/projetos/                            Projetos (noindex até haver casos de clientes)
/projetos/identidade-tama-creative/   Caso real
/sobre/                               Sobre
/solicitar-proposta/                  Formulário
/obrigado/                            Confirmação (noindex; usado se o JS falhar)
/privacidade/                         LGPD
/404.html                             Erro
```

## 5. Decisões importantes
- **Stack:** HTML estático gerado por Python (`build.py`), sem framework e sem dependências no navegador. É o que dá 97–100 no Lighthouse e indexação completa sem JavaScript.
- **Formulário:** Netlify Forms registra e envia o e-mail; o n8n recebe pela função de evento `submission-created`, que roda no servidor e lê a URL de uma variável de ambiente. O site só mostra "Recebemos o seu pedido" quando o Netlify responde 200.
- **Projetos:** os exemplos com mockups estão marcados como "Exemplo conceitual" e a página fica fora do Google até existirem casos de clientes reais. O caso da identidade da TaMa é real.
- **Páginas de produto individuais:** não criadas. Sem fotos reais de cada peça, seriam páginas rasas; cada peça tem âncora própria na curadoria (ex.: `/brindes-corporativos-premium/#ritual-de-cafe`).

## 6. Recomendações futuras (não implementadas)
1. Fotografar as peças da curadoria (lista em `PENDENCIAS.md`) e então criar páginas individuais das mais procuradas.
2. Publicar 2 guias sazonais antes de novembro (ver `SEO.md`).
3. Cadastrar os primeiros casos de clientes reais e tirar o `noindex` de `/projetos/`.
4. Conectar o projeto a um repositório Git privado e ativar builds automáticos no Netlify.
5. Avaliar lookbooks por segmento (saúde, tecnologia, eventos) como páginas web, não PDF.

## 7. Versão 2 — visual novo sobre a base de produção (outubro/2026)

Rascunho para aprovação: https://v2-aprovacao--tamacreative.netlify.app (a produção só muda depois do aceite).

### O que entrou da v2
- Tema claro (fundo `#FAF7F2`), paleta vinho `#501B2B`, verde `#203728`, âmbar `#B87742` e coral `#D5483A`; tipografia DM Sans + Playfair Display (Jost removida). As fontes ficam no próprio domínio.
- Abertura em carrossel com 3 slides (presentes, marca, vestuário): um único H1, slides inativos com `inert`, botão de pausa, troca automática desligada com movimento reduzido, toque e setas do teclado.
- Vitrines horizontais com filtro por categoria, 6 coleções por ocasião, faixa de processo e chamada final.
- Fichas de produto com foto, cores de referência (o nome da cor muda ao escolher), materiais, técnicas e botão "Selecionar"; a cor escolhida vai para a seleção.
- Sacola no cabeçalho com contador, gaveta lateral (`<dialog>`) com a seleção e foto ampliada (lightbox) com botão de seleção.
- Curadoria completa com 38 itens: 21 peças com foto e 17 ideias "além do óbvio" da versão anterior. Os filtros por categoria e ocasião ficam na URL (`?categoria=&ocasiao=`), então as coleções da home abrem a curadoria já filtrada.

### O que foi mantido da base
Logo oficial (arco à esquerda), páginas separadas com SEO e dados estruturados, formulário real (Netlify Forms + função n8n, sucesso só com resposta 200), redirecionamento dos links antigos com `#`, contatos ocultos enquanto não configurados, cabeçalhos de segurança, testes e documentação. Mockups com o logo da TaMa continuam só no caso real e em `/projetos/`.

### Imagens
As 25 fotos da v2 (`img/v2/`) são **imagens conceituais**, não fotos de trabalhos entregues. O site diz isso no texto alternativo ("Fotografia conceitual: …") e em avisos visíveis na home e na curadoria ("ilustram possibilidades; não representam estoque nem trabalhos para clientes"). A troca por fotos reais está em `PENDENCIAS.md`.

### Medições no rascunho (Lighthouse 13.5, laboratório, Edge)

| Página | Celular (Perf · A11y · BP) | LCP celular | Desktop (Perf · A11y · BP) |
|---|---|---|---|
| Início | 99 · 100 · 100 | 2,1 s | 100 · 100 · 100 |
| Curadoria premium | 99 · 100 · 100 | 1,9 s | 100 · 100 · 100 |
| Kits corporativos | 99 · 100 · 100 | 1,9 s | 100 · 100 · 100 |
| Solicitar proposta | 99 · 100 · 100 | 1,8 s | 100 · 100 · 100 |

CLS 0 em todas. O SEO deu 100 no rascunho com endereço fixo; no rascunho comum aparece 66–69 só porque o Netlify marca rascunhos com `noindex` (esperado). O LCP no celular passou de 1,3–1,7 s para 1,8–2,1 s porque a v2 tem mais fotos na primeira dobra, e continua na faixa "bom" (≤ 2,5 s). Correção feita depois da medição: o selo "Seleção TaMa" saiu de dentro do botão de ampliar foto, porque o nome acessível do botão não continha o texto visível.

### Verificações
- `tests/e2e.mjs`: 34/34. Cobre carrossel, filtro das vitrines, troca de cor, seleção com cor, contador, gaveta, lightbox, 38 itens na curadoria, filtros combinados e na URL, estado vazio e todo o fluxo do formulário.
- axe-core: 0 violações em início, curadoria, kits, branding e proposta. Nenhuma rolagem horizontal em 1440, 1024, 768, 390 e 320 px. Console sem erros.

## 8. Publicação de 12/10/2026 — v2, blog, processo e mockups com a marca

Publicado em produção (https://tamacreative.netlify.app; o domínio tamacreative.com.br entra quando o DNS for trocado no Registro.br), com aprovação do usuário:
- **v2 visual** (seção 7).
- **Blog** em `/blog/`, com 4 artigos (ver `BLOG.md`).
- **Seção "Do briefing à entrega"**: método em 6 etapas, com a chamada final.
- **Mockups com a marca**: 27 imagens com a identidade TaMa (e 4 com marcas fictícias, identificadas), mais o bloco "Sua marca é a protagonista", o selo "Personalizável com sua marca" nos cards e os avisos novos (ver `BRIEFING-MOCKUPS.md`).

Verificações antes da publicação:
- `tests/e2e.mjs`: 67/67.
- axe-core, sem violações; sem rolagem horizontal; console limpo. Páginas: início, curadoria, kits, confecções, blog e proposta.
- Netlify: formulário `proposta` com os 11 campos e função `submission-created` ativa.
