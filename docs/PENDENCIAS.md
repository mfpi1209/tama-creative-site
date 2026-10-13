# Pendências — informações e assets

## Informações (bloqueiam itens visíveis no site)
| Item | Onde entra | Como resolver |
|---|---|---|
| Número de WhatsApp comercial | Botão flutuante, CTAs, página de proposta, JSON-LD | `whatsapp` em `site.config.json` |
| E-mail comercial | Rodapé, proposta, privacidade, JSON-LD | `email` em `site.config.json` |
| @ do Instagram | Rodapé, `sameAs` | `instagram` em `site.config.json` |
| Troca dos servidores DNS no Registro.br | Domínio definitivo | Ver `DEPLOY.md` › Domínio |
| URL do webhook n8n | Repasse de leads ao CRM | `N8N_WEBHOOK_URL` no Netlify |
| ID do GA4 | Medição | `GA4_ID` |
| Razão social / CNPJ (quando existirem) | Política de privacidade, rodapé | Editar `page_privacidade` em `build.py` |
| Primeiros casos de clientes (com autorização) | `/projetos/` | Novo bloco em `page_projetos` + página do caso; remover `noindex` |
| Quantidades mínimas e prazos médios por tipo | FAQs | Hoje as respostas dizem "definido na proposta"; não foram inventados números |

## Fotografias necessárias
Desde a v2, as 21 peças da vitrine e as aberturas usam **imagens conceituais** (`img/v2/`), sinalizadas no texto alternativo e em avisos visíveis. As 17 ideias "além do óbvio" usam ícones desenhados. Nenhuma imagem mostra trabalho entregue a cliente.

Para trocar por fotos reais: fotografar cada peça **personalizada com uma marca de exemplo ou com a TaMa**, fundo creme ou pedra, luz natural lateral, mínimo 2000 px, no enquadramento 850:780 (o das fichas), e fazer uma versão 16:9 para as aberturas. Ao trocar, salvar em `img/`, apontar o campo `img` da peça em `src/data/curadoria.json` e tirar "conceitual" do texto alternativo dela; quando todas forem reais, remover os avisos de imagem conceitual.

| Prioridade | Peças |
|---|---|
| 1 — aparecem na home | Bandeja em couro, Kit boas-vindas, Moletom exclusivo, Kit de papelaria, Garrafa térmica, Caneca de cerâmica |
| 2 — vitrine | Caderno premium, Polo personalizada, Bolsa tote estruturada, Boné premium, Sacola corporativa, Caixa rígida premium, Cartões de marca, Agenda executiva, Embalagem presente, Manta de aconchego, Caneta executiva, Uniforme personalizado, Organizador de mesa, Kit vestuário, Paleta e aplicações |
| 3 — além do óbvio (hoje com ícone) | Objeto de mesa em pedra, Calendário perpétuo, Vela com fragrância assinada, Ritual de café, Chá em latas, Tábua de queijos, Guardanapos de linho, Máscara de olhos com peso, Garrafa de vidro com cortiça, Meias com o padrão da marca, Lenço estampado, Baralho exclusivo, Dominó em madeira, Kit horta, Postais ilustrados, Carregador sem fio em pedra, Cabo em estojo de couro |

Também: 1 foto da fundadora para `/sobre/` (opcional), fotos de bastidores (separação de materiais, conferência) e fotos reais dos kits entregues para os casos.

Não usar imagens de bancos ou de fornecedores sem licença.
