# Simulador "Veja sua marca em nossos produtos" (/veja-sua-marca/)

O visitante envia o logo, escolhe uma peça da curadoria e a cor, e vê a prévia na hora. Para receber o mockup em alta, deixa nome e e-mail: vira lead.

## Como funciona

```
navegador (src/simulador.js)                       Nginx do site                 n8n (tama_n8n:5678)
 1. lê o logo (SVG sanitizado, PNG, JPG ≤ 5 MB)
 2. compõe o logo na foto-base da peça/cor  ──►  POST /api/simulador  ──►  /webhook/simulador
    (perspectiva + efeito do material)          4 envios/min por IP        valida → registra o lead → responde 200
 3. prévia 720 px com marca-d'água              até 8 MB por envio         → (opcional) render premium OpenAI
 4. no envio: mockup 1600 px sem marca-d'água                              → e-mail ao cliente + aviso à equipe
```

- **Prévia fiel, sem IA.** É o mesmo motor dos mockups do site (`tools/mockup-engine/brand.py`) portado para o navegador:
  o logo do cliente entra na área de aplicação de cada foto, com perspectiva e o efeito da técnica (hot stamping,
  baixo-relevo, silk/impressão, gravação a laser, bordado). Nada sai do navegador até o envio.
- **Incentivo do lead:** a prévia é de baixa resolução e tem marca-d'água; o mockup em alta vai por e-mail.
- **IA opcional e desligada por padrão.** Quando ligada no n8n, a OpenAI recebe a composição pronta e só refina o
  acabamento. O resultado vai **só para a equipe** revisar, a não ser que você ligue o envio ao cliente. Sempre é
  apresentado como ilustrativo.

### Onde estão as peças
| Arquivo | O que é |
|---|---|
| `src/simulador.js` | motor de composição + passo a passo (carregado só em /veja-sua-marca/) |
| `src/simulador.css` | estilos da página (inline só nela) |
| `src/site.js` | convite de saída e link "Ver com a minha marca" nos cards |
| `src/data/simulador.json` | áreas de aplicação de cada foto (gerado) |
| `img/simulador/<foto>~<cor>.webp` | fotos-base sem marca, 1600 px, 84 arquivos (gerados) |
| `tools/mockup-engine/` | motor Python, especificações das áreas e `simulador_export.py` |
| `deploy/n8n/simulador.json` | workflow para importar no n8n |
| `deploy/nginx.conf` | `location = /api/simulador` (limite de envios e tamanho) |

## Colocar no ar (uma vez)

### 1. n8n: importar o workflow
1. Abra o n8n (https://tama-n8n.logwdi.easypanel.host) › **Workflows › Import from File** › `deploy/n8n/simulador.json`.
2. Abra o nó **Configuração** e preencha:
   - `cfg_remetente`: o remetente dos e-mails, do mesmo domínio da conta SMTP. Ex.: `TaMa Creative <contato@tamacreative.com.br>`.
   - `cfg_email_equipe`: quem recebe o aviso de cada lead.
   - Os demais já vêm prontos (`cfg_site`, `cfg_whatsapp`, IA desligada).

   Sem `cfg_remetente` e `cfg_email_equipe`, o webhook responde 503 e o site mostra "Não conseguimos enviar agora". Nenhum lead se perde sem aviso.

### 2. n8n: e-mail (SMTP), que é credencial sua
1. Em **Credentials › Create › SMTP**, preencha host, porta, usuário, senha e SSL/TLS do provedor de e-mail da TaMa.
2. Selecione essa credencial nos quatro nós de e-mail:
   - E-mail ao cliente
   - Aviso à equipe
   - E-mail com o link
   - Aviso à equipe (link)

A senha fica só no n8n. Não vai para o site nem para o repositório.

### 3. n8n: tabela dos leads
**Overview › Data tables › Create** com o nome `simulador_leads` e estas colunas, todas do tipo texto (string):

`recebido_em, etapa, nome, email, empresa, whatsapp, produto, cor, aplicacao, pagina, logo_arquivo`

O nó **Registrar lead** grava uma linha por envio. Se a tabela não existir, o fluxo segue e o lead ainda chega por e-mail.

### 4. Ativar e publicar
1. Ative o workflow no n8n (botão **Active**).
2. Faça o merge do PR. O Nginx novo (`/api/simulador`) entra com o deploy do site.
3. Teste em produção: abra `/veja-sua-marca/`, envie um logo, peça o mockup com o seu e-mail e confira os dois e-mails.

### 5. (Opcional) Render premium com a OpenAI: chave sua
1. Em **Credentials › Create › OpenAI**, cole a API key. Selecione a credencial no nó **Render premium (OpenAI)**.
2. No nó **Configuração**:
   - `cfg_ia_ativa` = `true`
   - `cfg_ia_enviar_ao_cliente`: deixe `false` para a equipe revisar antes de mandar qualquer coisa ao cliente.
   - Se quiser, ajuste `cfg_ia_modelo` (padrão `gpt-image-1.5`) e `cfg_ia_qualidade` (`low`, `medium` ou `high`).
3. No `site.config.json` do site, ponha `"simulador_ia": true` e publique. Isso acrescenta a OpenAI ao consentimento e à política de privacidade, o que é obrigatório antes de ligar a IA.
4. O parâmetro `input_fidelity=high` (no nó HTTP) preserva melhor o logo, mas só existe nos modelos `gpt-image-1` e `gpt-image-1.5`. Para outro modelo, apague essa linha do nó.

Custos e limites seguem a sua conta da OpenAI. Se a chamada falhar, o fluxo segue só com o mockup do site e o aviso à equipe registra o erro.

## Privacidade e retenção (LGPD)
- **Consentimento:** é explícito, sem caixa pré-marcada, e o texto aparece no formulário. A política está em `/privacidade/#simulador`.
- **Uso do logo:** só para o mockup e, se o cliente pedir, para a proposta.
- **Arquivos em até 30 dias:**
  - **n8n:** o workflow não guarda execuções bem-sucedidas (`saveDataSuccessExecution: none`). As com erro ficam até a limpeza automática do n8n (`EXECUTIONS_DATA_MAX_AGE`, padrão de 336 h = 14 dias). Não aumente esse valor acima de 720 h.
  - **Caixa de e-mail da equipe:** o aviso traz o logo e o mockup em anexo. Crie um filtro ou marcador "Simulador" e apague as mensagens com mais de 30 dias. No Gmail, por exemplo, busque `label:simulador older_than:30d`. Exceção: o cliente que contratar o projeto.
  - **Data table:** guarda só os dados de contato, sem arquivos. Apague a linha quando o titular pedir a exclusão.
- **Segredos:** nenhum segredo no site ou no Git. A chave da OpenAI e o SMTP são credenciais do n8n.

## Respostas do webhook (o que o site mostra)
| Código | Quando | No site |
|---|---|---|
| 200 `{ok:true}` | lead registrado (os e-mails saem logo depois) | "O mockup em alta segue para …" |
| 200 (silencioso) | honeypot preenchido (robô) | idem, sem processar |
| 422 `{ok:false, erro}` | campo ou arquivo inválido (`email`, `consentimento`, `logo`, `mockup`…) | "Não conseguimos enviar agora" + tentar de novo / WhatsApp |
| 503 | configuração do n8n incompleta | idem |
| 413 / 429 | Nginx: envio acima de 8 MB / mais de 4 envios por minuto | idem |

O convite de saída usa o mesmo webhook com `etapa=lembrete`. Ele leva só o e-mail e o consentimento, e o n8n envia o link do simulador.

## Convite de saída
- **Computador:** o mouse sai pela borda de cima da janela, depois de 8 s na página.
- **Celular:** rolagem rápida para cima depois de ler parte da página (com pelo menos 15 s na página), ou 75 s de leitura com rolagem.
- **Frequência:** uma vez por sessão. Fechado (X, Esc, "Agora não" ou clique fora), volta só depois de 7 dias. Não aparece para quem já usou o simulador.
- **Onde não aparece:** no próprio simulador, na proposta, em "obrigado", na privacidade e no 404.

## Manutenção
**Nova peça ou nova cor na curadoria.** O build avisa se faltar foto-base.
1. Acrescente a especificação da foto em `tools/mockup-engine/specs*.py` (o mesmo formato dos mockups do site).
2. Rode o export. Ele usa numpy, scipy, Pillow e resvg-py.
   - Sem as bases ampliadas 4x em `midia/mockups/x4/` (349 MB, fora do Git), o motor amplia com LANCZOS, o que basta para 1600 px.
```bash
pip install numpy scipy
python -I tools/mockup-engine/simulador_export.py        # gera só o que falta
python -I tools/mockup-engine/simulador_export.py --json # só as áreas
```
**Logo pequeno ou grande demais numa peça.** Ajuste `FIT_OVERRIDE` em `simulador_export.py`: largura e altura máximas relativas à caixa original, mais a área máxima. Depois rode com `--json`.

**Testes.** Veja `docs/DEPLOY.md` › Testes. O `tests/e2e.mjs` cobre o passo a passo, o upload (formato, tamanho, SVG malicioso), o envio interceptado, o convite de saída e o axe (se o `axe-core` estiver instalado junto do puppeteer-core).

## Limites conhecidos
- **Textos em SVG:** são desenhados com fontes do sistema. Peça o logo com os textos em curvas.
- **Fundo do logo:** um fundo liso branco ou preto sai sozinho; fundo colorido não. O visitante pode ligar ou desligar a remoção.
- **É uma prévia ilustrativa:** técnica, cores, tamanho e posição finais são definidos e aprovados na proposta. A página, o e-mail e a legenda dizem isso.
