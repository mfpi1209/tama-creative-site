# Pendências — o que depende da TaMa

Lista do que só a TaMa pode fornecer, confirmar ou autorizar. Enquanto um item estiver em aberto, o site não
inventa a informação: o campo fica oculto ou a resposta diz que o dado é "confirmado na proposta".

A coluna **Bloqueia** diz o que fica parado sem o item.

## (a) Acessos

| Item | Bloqueia | Referência |
|---|---|---|
| n8n de produção (acesso de administrador) | Validar que os pedidos são gravados e avisados em produção; importar os workflows novos; recuperar pedidos antigos que possam não ter chegado a ninguém; ler a origem dos pedidos | `docs/PROPOSTAS.md` › O que falta |
| Easypanel | Confirmar se o app do site usa a branch `deploy`; ligar o deploy automático; conferir o nome do container do n8n (`tama_n8n`) | `docs/DEPLOY.md` |
| Conta Netlify | Garantir que `tamacreative.netlify.app` só redireciona; apagar envios antigos de Forms (depois de repassar pedidos que estiverem lá); login do editor `/admin/`, que usa o OAuth do Netlify com o GitHub | `docs/DEPLOY.md` › Netlify |
| GA4 (conta Google para criar a propriedade) | Qualquer medição no Google; conversões | `docs/MEDICAO.md` |
| Search Console (acesso ao DNS do domínio para a verificação) | Envio do sitemap, pedidos de indexação, dados de consultas e cliques | `docs/SEO.md` › Checklist |

## (b) Dados da empresa

Todos entram em `site.config.json`. Vazio = não aparece no site.

| Item | Onde aparece | Bloqueia |
|---|---|---|
| Razão social (`razao_social`) | Rodapé, Sobre, Privacidade, dados estruturados (`legalName`) | Identificação da empresa na política de privacidade |
| CNPJ (`cnpj`) | Rodapé, Sobre, dados estruturados (`taxID`) | Idem |
| Cidade (`cidade`) | Rodapé, Sobre, dados estruturados (endereço) | Informar onde a TaMa está |
| E-mail comercial (`email`) | Rodapé, contato, Privacidade, dados estruturados | Canal de contato além do WhatsApp; remetente e destinatário dos avisos do n8n |
| Instagram (`instagram`) | Rodapé, `sameAs` nos dados estruturados | Link para o perfil |
| Responsável comercial (`responsavel_comercial`) | Sobre ("Atendimento comercial") | Nome de quem atende |
| Prazo de resposta a pedidos | Hoje o site diz só "vamos responder pelo contato informado" | Prometer um prazo de retorno na página de proposta e na confirmação |

## (c) Informações comerciais

Hoje as perguntas frequentes respondem "definido na proposta". Nenhum número foi inventado.

| Item | Bloqueia |
|---|---|
| Quantidades mínimas por tipo de produto e técnica | Respostas objetivas nas perguntas frequentes |
| Prazos médios por tipo (brindes, confecções, kits, ativações) | Idem; orientação de antecedência para fim de ano |
| Regiões atendidas (entrega e ativações) | Dizer onde a TaMa entrega e onde faz ações presenciais |
| Emissão de nota fiscal | Responder a uma dúvida comum de compradores de empresas |
| Escopo de ativações: equipe (promotores), logística, autorizações do local | Texto definitivo de `/ativacoes-promocionais/` (hoje: "a proposta detalha o que a TaMa coordena") |
| Escopo de hotelaria e gastronomia: quais peças a TaMa fornece de fato, para que tipo de cliente | Texto definitivo de `/hotelaria-e-gastronomia/` |

## (d) Confirmações de produto

Todas as fotos estão em `revisao` e todos os materiais e técnicas estão `a_confirmar`. O site mostra
"Material e técnica sob consulta" e o build falha se o nome, a descrição ou o texto alternativo afirmarem material ou
capacidade antes da confirmação (ver `docs/BANCO-IMAGENS.md`).

| Item | Bloqueia |
|---|---|
| Material, técnica e capacidade dos 51 modelos (com o fornecedor) | Mostrar especificação no catálogo; usar palavras como "couro", "inox" ou "400 ml" no nome e na descrição |
| Os dez modelos reais de caneta (básica, giro, grip, ponta touch, ecológica kraft, ecológica natural, executiva com estojo, executiva esferográfica, executiva roller, slim) | Manter as dez no catálogo como modelos reais |
| Saquinho transparente: EVA ou PVC, e qual modelo | Descrição do saquinho |
| Couro legítimo ou sintético: agenda, cardápio, carteira, chaveiro com tira, estojo de escritório, nécessaire, porta-canetas e vela (peças que citam couro no inventário) | Chamar de couro; separar em modelos diferentes, se for o caso |
| Taças de champagne, gin e vinho: se são de acrílico e qual a capacidade | Descrição e capacidade das taças |
| Aprovação das 208 fotos (todas ilustrativas, geradas com IA) | Marcar como `aprovada`; hoje todas aparecem como ilustrativas |
| Trocar fotos com o logo errado: **Carteira**, **Chaveiro com tira**, **Caneta ecológica natural** | Aprovação dessas fotos (precisam de nova imagem ou ajuste com `tools/logo_ajuste.py`) |

## (e) Ideias sem foto que saíram do site

Estas 17 ideias apareciam com ícone, sem foto e sem fornecedor. Saíram do site e podem voltar como modelos do
catálogo se houver fornecedor (e foto) para cada uma:

1. Objeto de mesa em pedra
2. Calendário perpétuo
3. Vela com fragrância assinada
4. Ritual de café
5. Chá em latas
6. Tábua de queijos
7. Guardanapos de linho
8. Máscara de olhos com peso
9. Garrafa de vidro com cortiça
10. Meias com o padrão da marca
11. Lenço estampado
12. Baralho exclusivo
13. Dominó em madeira
14. Kit horta
15. Postais ilustrados
16. Carregador sem fio em pedra
17. Cabo em estojo de couro

Bloqueia: voltar com qualquer uma delas. Para voltar, cada uma precisa de fornecedor e foto, e entra como qualquer
modelo (ver `docs/BANCO-IMAGENS.md` › Fluxo).

## (f) Fotos e provas

| Item | Bloqueia |
|---|---|
| Fotos reais de kits montados e de entregas | Trocar imagens ilustrativas por fotos de trabalho real |
| Novas fotos de kits em outras paletas (geradas com IA quando houver crédito na API de imagens) | Variedade de cores nos kits; custo por imagem (ver `tools/variacoes.py`) |
| Projetos realizados, com autorização do cliente | Qualquer página ou bloco de casos (a antiga `/projetos/` foi retirada e redireciona para `/sobre/`) |
| Depoimentos reais, com autorização | Bloco de depoimentos; nenhum foi escrito no lugar |

Não usar imagens de bancos ou de fornecedores sem licença.
