# Medição

O que o site mede, onde ler cada número e o que ainda falta configurar.

Regra de leitura: **pedido é o que está gravado na data table `tama_propostas` do n8n.** O analytics mostra
interesse e caminho; não substitui a tabela. Quem recusa os cookies não aparece no GA4, mas o pedido dele aparece
na tabela.

## Como funciona

- Todo evento vai para o `dataLayer` da página, sempre.
- O **GA4** só recebe eventos quando existe um ID configurado **e** o visitante clica em **Aceitar** no banner de
  consentimento. Sem ID, o banner nem aparece. Com "Recusar", o Google Analytics não carrega.
- A escolha fica guardada no navegador (`tama-consent`). Para ver o banner de novo, apague os dados do site no
  navegador.
- O código está em `src/site.js` (função `track`) e o banner em `build.py` (`shell()`).

## Eventos

| Evento | Quando acontece | Parâmetros | Leitura |
|---|---|---|---|
| `cta_solicitar_proposta` | Clique em qualquer botão ou link de proposta | `label` (qual botão), `page`, `interesse` quando o botão traz um kit ou serviço | Interesse em pedir proposta. Ainda não é pedido. |
| `form_start` | Primeira vez que o visitante entra em um campo do formulário | — | Começou a preencher. |
| `proposta_gravada` | O n8n confirmou que gravou o pedido (`gravado: true` com o mesmo `pedido_id`) | `tipo`, `pecas` (quantas peças selecionadas), `origem` (página antes do formulário), `duplicado` | **Pedido recebido.** É a conversão principal. |
| `proposta_falha` | O envio não foi confirmado | `tipo`, `motivo`: `http_xxx` (erro do servidor, ex.: `http_502`), `tempo_esgotado` (mais de 20 s), `rede`, `resposta_invalida`, `nao_confirmado` | Pedido que pode não ter chegado. Acompanhar sempre. |
| `whatsapp_click` | Clique em qualquer link de WhatsApp (botão flutuante, rodapé, páginas, tela de erro do formulário) | `label`, `page`, `interesse` quando houver | **Intenção de contato. Não é venda nem pedido.** A conversa acontece fora do site. |
| `view_service` | Abertura de uma página de frente | `service`: `brindes`, `kits`, `ocasioes`, `confeccoes`, `ativacoes`, `hotelaria` | Qual frente atrai visitas. |
| `select_product` | "+ Selecionar" em uma peça | `item` (id do modelo) | Interesse em produto. |
| `select_color` | Troca de cor em um card | `item`, `color` | Interesse em produto. |
| `zoom_product` | Ampliação da foto de uma peça | `item` | Interesse em produto. |
| `open_selection` | Abertura da gaveta "Minha seleção" | — | Interesse em produto. |
| `filter_curadoria` | Clique em um filtro (ocasião ou categoria) | `filter`, `value` | Interesse por ocasião ou categoria. |

Sobre `duplicado`: quando a primeira tentativa foi gravada mas a resposta não chegou ao navegador, o visitante vê o
erro (`proposta_falha`), tenta de novo e recebe `proposta_gravada` com `duplicado: true`. O n8n não grava o pedido
duas vezes. Para contar pedidos no GA4, cada `proposta_gravada` vale um pedido; a contagem certa continua sendo a da
tabela.

O WhatsApp abre com uma mensagem pronta que cita o assunto da página e as peças selecionadas. Isso ajuda a equipe a
saber de onde a conversa veio, mas o GA4 só registra o clique.

### O que não vai para o analytics

A origem completa do pedido vai **só para o n8n**, junto com o formulário: `origem_pagina` (última página antes do
formulário), `primeira_pagina` (primeira página da visita), `referencia` (site externo de onde a pessoa veio) e
`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`. Nome, contato e demais dados do formulário
também não vão para o analytics. O único dado de origem no GA4 é o parâmetro `origem` do `proposta_gravada`, que é
apenas o endereço de uma página do site.

## Conversões no GA4

| Evento | Marcar como | Observação |
|---|---|---|
| `proposta_gravada` | **Evento principal (conversão)** | Única conversão principal. |
| `whatsapp_click` | Micro-conversão (evento-chave secundário, se for marcado) | Deixar claro em qualquer relatório: **clique não é venda nem pedido**. Não somar com `proposta_gravada`. |
| Demais eventos | Não marcar | Servem para entender o caminho até o pedido. |

Para ver os parâmetros nos relatórios do GA4, cadastre-os como dimensões personalizadas (escopo de evento) em
Admin › Definições personalizadas: pelo menos `tipo`, `motivo`, `service`, `item`, `label`, `interesse` e `origem`.

## Como ativar o GA4

1. Criar a propriedade GA4 da TaMa e copiar o ID de medição (formato `G-…`).
2. Preencher `ga4_id` em `site.config.json` **ou** definir a variável de ambiente `GA4_ID` no build.
3. Publicar (ver `docs/DEPLOY.md`). O banner de consentimento passa a aparecer e a política de privacidade passa a
   citar o Google Analytics.
4. No DebugView do GA4, aceitar os cookies no site e conferir os eventos acima, em especial um `proposta_gravada`
   feito com um pedido de teste combinado (ver `docs/PROPOSTAS.md`).
5. Marcar `proposta_gravada` como evento principal e, se quiser, `whatsapp_click` como micro-conversão.

## Origem dos pedidos (data table `tama_propostas`)

Abra a data table `tama_propostas` no n8n de produção. Cada linha é um pedido. Colunas úteis para medir:

| Coluna | Para que serve |
|---|---|
| `recebido_em` | Data e hora do pedido. |
| `tipo` | Frente escolhida no formulário (`brindes`, `kits`, `confeccoes`, `ativacoes`, `hotelaria`, `integrado`). |
| `interesse` | Kit, serviço ou página que levou ao formulário. |
| `selecao` | Peças e cores escolhidas no site. |
| `origem_pagina` | Última página vista antes do formulário. |
| `primeira_pagina` | Por onde a pessoa entrou no site (ex.: um artigo do blog). |
| `referencia` | Site externo de origem (ex.: um buscador ou rede social). Vazio = acesso direto ou sem informação. |
| `utm_*` | Campanha, quando o link usado tinha UTMs. |
| `status` | Andamento do pedido (abaixo). |

Perguntas que a tabela responde: quantos pedidos por mês e por `tipo`; quais páginas de entrada e de saída geram
pedidos; quantos vieram do blog (`primeira_pagina` começando com `/blog/`); quais campanhas trouxeram pedidos.

Para campanhas, use links com UTMs, por exemplo
`https://tamacreative.com.br/kits-corporativos/?utm_source=instagram&utm_medium=social&utm_campaign=fim-de-ano`.
Os UTMs ficam guardados só durante a visita e seguem com o pedido.

## Funil fora do site

O site termina no pedido gravado. O resto do funil é registrado pela equipe na coluna `status` da mesma tabela:

| `status` | Quem muda | Quando |
|---|---|---|
| `novo` | O n8n, ao gravar | Pedido recebido, ninguém respondeu ainda. |
| `em proposta` | Equipe comercial | Primeiro contato feito, proposta em preparo. |
| `proposta enviada` | Equipe comercial | Proposta entregue ao cliente. |
| `ganho` | Equipe comercial | Cliente aprovou. |
| `perdido` | Equipe comercial | Cliente desistiu ou não respondeu. |

Use exatamente esses textos, para a contagem funcionar. Leitura mensal sugerida: pedidos recebidos, quantos
chegaram a `proposta enviada` e quantos viraram `ganho`, separados por `tipo` e por `primeira_pagina`.

Conversas que começam no WhatsApp não passam pelo formulário e não entram na tabela. Se a TaMa quiser medi-las no
mesmo funil, a equipe precisa registrá-las (na própria tabela ou no sistema que usar), indicando que vieram do
WhatsApp.

## Pendente

- [ ] **Propriedade GA4**: ainda não existe; não há ID. Sem ele, só o `dataLayer` recebe eventos e nada é medido no
      Google. Depende da TaMa (conta Google).
- [ ] **Search Console**: propriedade de domínio `tamacreative.com.br` ainda não verificada; depois, enviar o
      sitemap (ver `docs/SEO.md` › Checklist).
- [ ] **n8n de produção** com os workflows novos e a tabela `tama_propostas` (ver `docs/PROPOSTAS.md` › O que falta).
      Sem isso não há origem de pedidos para ler.
- [ ] Combinar com a equipe quem atualiza o `status` e com que frequência.
- [ ] Depois de ativar o GA4: cadastrar as dimensões personalizadas e marcar as conversões.
