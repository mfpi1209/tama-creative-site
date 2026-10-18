# Pedidos de proposta: do formulário ao responsável

Caminho em produção: navegador → `POST /api/proposta` (Nginx do site, limite de 6 envios/min por IP) →
`http://tama_n8n:5678/webhook/proposta` (rede interna do Easypanel) → workflows do n8n abaixo.

Nenhuma credencial fica no site: o navegador só conhece `/api/proposta`. SMTP e e-mail do responsável ficam no n8n.

## Regra principal

O site só mostra **"Recebemos o seu pedido"** quando o n8n responde `{"gravado": true, "pedido_id": <o mesmo enviado>}`,
e o n8n só responde isso **depois de gravar** o pedido na data table `tama_propostas`. Qualquer outra resposta
(erro HTTP, HTML, JSON sem `gravado`, n8n fora do ar, mais de 20 s sem resposta, rede) mostra "Não conseguimos
confirmar o seu pedido", com "Tentar de novo", "Copiar resumo" e o resumo pronto para o WhatsApp.

## Contrato

**Pedido** (`application/x-www-form-urlencoded`, cabeçalho `X-TaMa-Envio: fetch` quando vem do site com JavaScript):

| Campo | Obrigatório | Observação |
|---|---|---|
| `pedido_id` | sim (envio pelo site) | UUID criado no navegador e **reenviado igual em cada nova tentativa**; um novo só depois de um envio confirmado. Sem JavaScript, o n8n cria um (`sjs-…`). |
| `nome`, `contato`, `objetivo`, `consentimento=sim` | sim | `contato` = e-mail válido ou telefone com DDD. |
| `tipo` | sim | `brindes`, `kits`, `confeccoes`, `ativacoes`, `hotelaria`, `integrado`. |
| `empresa`, `quantidade`, `data`, `orcamento` | não | |
| `selecao` | não | Peças e cores escolhidas no site (`Caneca (Branco); …`). |
| `interesse` | não | Kit, serviço ou página que levou ao formulário (`?interesse=` no link). |
| `origem_pagina`, `primeira_pagina`, `referencia` | não | Última página antes do formulário, primeira página da visita e domínio de referência externo. |
| `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content` | não | Guardados só na sessão do navegador; não vão para o analytics. |
| `bot-field` | — | Honeypot: preenchido = spam, nada é gravado. |

**Respostas do n8n:**

| Situação | HTTP | Corpo |
|---|---|---|
| Gravado agora | 200 | `{"ok":true,"gravado":true,"duplicado":false,"pedido_id":"…"}` |
| Já estava gravado (nova tentativa, clique repetido, timeout que chegou depois) | 200 | `{"ok":true,"gravado":true,"duplicado":true,"pedido_id":"…"}` — não grava de novo nem avisa de novo |
| Dados inválidos | 422 | `{"ok":false,"gravado":false,"erro":"invalido","campos":[…]}` |
| Honeypot | 200 | `{"ok":true}` (sem `gravado`: o site mostraria erro, o que não afeta pessoas) |
| Falha ao gravar (tabela ausente, banco fora) | 500 | erro do n8n → o site mostra erro |

## Workflows (pasta `deploy/n8n/`)

| Arquivo | Função |
|---|---|
| `proposta-tabela.json` | **3/3, rodar uma vez**: cria a data table `tama_propostas` (não recria se já existir). |
| `proposta.json` | **1/3**: recebe, valida (campos de uma linha perdem quebras de linha, para ninguém forjar linhas no aviso), procura o `pedido_id`, grava e só então responde. Depois de gravar, confere de novo: se dois envios simultâneos do mesmo pedido gravaram, fica só a primeira linha e o outro recebe `duplicado:true`. |
| `proposta-avisos.json` | **2/3**: a cada minuto, reserva cada pedido com `notificacao` ≠ `enviada` (marca `enviando` e soma 1 em `tentativas_aviso` antes de enviar, o que impede duas execuções de mandarem o mesmo aviso), envia o e-mail e marca `enviada` ou `falhou`. Um aviso por `pedido_id`. Até a 20ª tentativa tenta a cada minuto; depois, de hora em hora, para sempre. Na 20ª falha a execução termina em erro (aparece na lista de execuções e no Error Workflow, se houver). Um pedido parado em `enviando` por mais de 10 minutos é tentado de novo. |

Colunas de `tama_propostas`: `pedido_id`, `recebido_em`, `status` (`novo`; a equipe pode usar `em proposta`, `proposta enviada`,
`ganho`, `perdido`), dados do formulário, `origem_pagina`, `primeira_pagina`, `referencia`, `utm_*`,
`notificacao` (`pendente` → `enviada` | `falhou`), `tentativas_aviso`, `erro_aviso`, `avisado_em`.

**Recuperar ou reenviar um aviso:** abra a data table no n8n e mude `notificacao` do pedido para `pendente`. O workflow
2/3 envia no minuto seguinte (ou rode o 2/3 manualmente, "Reenviar agora").

**Execuções e dados pessoais (LGPD):** os workflows não guardam execuções bem-sucedidas (`saveDataSuccessExecution: none`);
os dados ficam só na tabela. As execuções **com erro** são guardadas de propósito: se a gravação falhar, a execução com erro
é a única cópia do pedido (abra-a no n8n para recuperar os dados). No n8n de produção, defina `EXECUTIONS_DATA_PRUNE=true` e
`EXECUTIONS_DATA_MAX_AGE=168` (7 dias), um prazo de guarda para `tama_propostas` e use SMTP com TLS.

## Validado localmente (17/10/2026, n8n 2.43.7, SMTP de teste)

- Pedido novo → 200 `gravado:true`, linha na tabela com interesse, seleção, página de origem e UTMs; aviso enviado no minuto seguinte.
- Mesmo `pedido_id` reenviado → `duplicado:true`, uma única linha.
- Inválido → 422 com a lista de campos. Honeypot → nada gravado. Sem JavaScript → gravado com id `sjs-…`.
- Tabela inexistente (falha de gravação) → 500 → o site mostra erro.
- SMTP recusando → pedido mantido com `notificacao=falhou` e o erro; com o SMTP de volta, enviado na tentativa seguinte.
- Revisão do fluxo (18/10): 20 envios simultâneos do mesmo pedido = 1 linha e 1 e-mail (antes: até 20); execuções de aviso
  sobrepostas = 1 e-mail por pedido; falha ao atualizar a linha depois do e-mail não reenvia sem fim; quebras de linha em
  nome/contato não forjam linhas no aviso. Testado em SQLite e Postgres.
- No navegador (site gerado + proxy igual ao Nginx): três cliques em "Enviar" = 1 POST; n8n fora (502), HTTP 200 sem
  confirmação e resposta acima de 20 s mostram erro; "Tentar de novo" reenvia o mesmo id; o pedido lento que chegou
  depois não foi duplicado.

## O que falta para validar em produção (precisa de acesso ao n8n e ao Easypanel)

1. Conferir o fluxo **ativo** hoje no n8n de produção. O que estava no repositório antes desta versão só validava e
   respondia 200, sem gravar nem avisar; se o de produção for igual, pedidos anteriores podem não ter chegado a ninguém.
   Verificar também a lista de execuções do webhook `proposta` no n8n para recuperar pedidos antigos.
2. Versão do n8n com **Data tables** (n8n 1.113 ou mais novo; testado na 2.43.7, em SQLite e em Postgres; a ordenação dos
   avisos por tentativas usa um recurso da 2.5 e é só ignorada em versões anteriores). Sem data tables, trocar os nós de
   tabela por Google Sheets ou Postgres mantendo a mesma ordem: verificar → gravar → responder.
3. Importar os três workflows, rodar o 3/3 uma vez, ativar (publicar) 1/3 e 2/3 e desativar o workflow antigo do
   mesmo caminho `proposta`.
4. Criar a credencial SMTP **"SMTP TaMa"** e, no nó "Enviar e-mail ao responsável" do 2/3, trocar
   `DEFINIR_EMAIL_DO_RESPONSAVEL` e `DEFINIR_REMETENTE@tamacreative.com.br`. Enquanto não estiver configurado, os
   pedidos são gravados normalmente e ficam `falhou` (visíveis na tabela) até o aviso funcionar.
5. Conferir que o container do n8n se chama `tama_n8n` na mesma rede do site (é o que `deploy/nginx.conf` usa).
6. Fazer um envio de teste combinado com a TaMa (nome "TESTE"), conferir a linha na tabela e o e-mail, e depois
   marcar o pedido como teste.
7. **Recomendado se o n8n tiver endereço público** (comum no Easypanel, por causa do editor): sem isso, quem chamar
   `/webhook/proposta` direto pula o limite de envios do Nginx. Testado localmente, ainda não aplicado ao repositório
   porque mexe na imagem do Nginx e não foi testado com Docker:
   - gerar um segredo (`openssl rand -hex 32`) e criá-lo como variável de execução `N8N_WEBHOOK_SEGREDO` no app do site;
   - no Nginx, um script em `/docker-entrypoint.d/15-n8n-segredo.sh` grava `map $host $n8n_segredo { default "<segredo>"; }`
     em `conf.d/` (aceita só `[A-Za-z0-9_-]`; sem a variável, fica vazio e só o formulário falha, nunca o site), e o
     `location = /api/proposta` ganha `proxy_set_header X-TaMa-Segredo $n8n_segredo;`;
   - publicar o Nginx primeiro; só depois, no n8n, ligar no nó "Formulário do site" a autenticação por cabeçalho
     (credencial Header Auth com Name `X-TaMa-Segredo`). Ordem inversa derruba o formulário (403).
