# Plano de refatoração do tamacreative.com.br a partir do creativedesign.com.br

Levantamento feito em 12/10/2026 lendo o HTML, os dados e o sitemap públicos de creativedesign.com.br. As afirmações sobre a Creative Design (números, clientes, certificações) são o que o site declara, e não foram verificadas. Nenhum texto ou imagem dela deve ser copiado. O que vale reaproveitar são ideias de estrutura, adaptadas à TaMa.

## 1. O que é o creativedesign.com.br

| Aspecto | O que o site mostra |
|---|---|
| Modelo | Catálogo de volume: cerca de 3.700 produtos, com mais de 3.600 URLs no sitemap |
| Categorias | Lazer, Office, Drinkware, Ecológicos, Diversos, Tecnologia, Gourmet, Vestuário, Premium (só 14 itens, quase todos de marca licenciada), Novidades e Promoção |
| Submarcas | **Made by Creative**: fabricação própria e sob medida. **Selected by Creative**: curadoria e importação própria |
| Ocasiões | Mais de 30 campanhas: onboarding, feiras, CIPA/SIPAT, Outubro Rosa, Setembro Amarelo, fim de ano, dias profissionais, viagem e saúde |
| Catálogos | 29 flipbooks em PDF: por segmento (agro, saúde, wellness, uniformes) e co-branded com clientes |
| Produto | Galeria com até 7 fotos, descrição longa, variações de cor, ficha técnica, cuidados de lavagem, FAQ por categoria e quantidade mínima |
| Orçamento | Carrinho de orçamento que exige conta (nome, e-mail, telefone e senha) para enviar |
| Prova social | 30 anos, sede de 4.300 m², ISO 9001, ABVTEX, logos de 22 grandes clientes e depoimentos |
| Conteúdo | Blog com 16 posts sazonais e por categoria, com links para as vitrines |
| Pontos fracos | Visual de e-commerce genérico, linha "premium" rasa, cadastro obrigatório para orçar, WhatsApp escondido, link quebrado, dois `<title>` por página, sem Open Graph, dados estruturados só do tipo LocalBusiness |

## 2. Leitura estratégica

A Creative Design vende **volume com prova de escala**. Competir no mesmo terreno (milhares de SKUs, preço, logos de multinacionais) seria perder. A TaMa vende **curadoria autoral com visão de Trade Marketing**, e o site novo já está à frente em clareza, desempenho, SEO técnico e atrito de orçamento: não pede cadastro, e as peças selecionadas vão direto para a proposta.

A refatoração deve importar a **estrutura comercial** que a Creative tem: ocasiões, linhas com nome, lookbooks, FAQ transparente e conteúdo sazonal. Tudo isso com a curadoria, a densidade editorial e a honestidade sobre mockups que já são da TaMa.

## 3. O que adotar (adaptado)

| # | Ideia da Creative | Versão TaMa | Página/URL | Pré-requisito |
|---|---|---|---|---|
| 1 | Navegação por campanha/ocasião | Hub **Ocasiões** com 5 a 6 momentos, cada um com seleção da curadoria e um guia curto | `/ocasioes/` e `/ocasioes/fim-de-ano/` etc. | Pelo menos 6 peças por ocasião e texto original |
| 2 | Submarcas Made by / Selected by | Duas linhas com nome: **Curadoria TaMa** (peças existentes, selecionadas) e **Feito pela TaMa** (desenvolvido sob medida: estampas, vestuário, embalagens) | Selos nas fichas e uma seção em cada serviço | Definir os nomes com a fundadora |
| 3 | Catálogos por segmento (PDF) | **Lookbooks web** por segmento, indexáveis e com links para a proposta | `/lookbooks/saude/`… | Fotos reais das peças |
| 4 | Catálogos co-branded por cliente | **Proposta viva**: página privada (noindex, com link secreto) para cada cliente, com as peças propostas e a arte aplicada | `/p/{cliente}-{código}/` | Fluxo n8n que gera a página a partir da proposta |
| 5 | Ficha técnica e cuidados | Ficha de vestuário com tecido, grade e cuidados de lavagem | Páginas de peça de confecção | Dados reais dos fornecedores |
| 6 | Página de personalizações | **Guia de técnicas** com fotos reais de cada acabamento | `/personalizacao/` | Fotos de amostras |
| 7 | FAQ comercial transparente | Mínimos, prazos médios, frete e faturamento por tipo de projeto | FAQs dos serviços | Números reais da operação |
| 8 | Blog sazonal ligado às vitrines | Guias do `SEO.md`, cada um com links para a curadoria e para o serviço | `/guias/…` | Redação própria |
| 9 | Configurador (placa de tempo de casa) | **Kit de reconhecimento** com escolha de 3 peças por faixa de tempo de casa | Seção em `/kits-corporativos/` | Opcional, fase 3 |
| 10 | Prova social | Logos e depoimentos **somente com autorização**, linha do tempo da TaMa | Home e `/sobre/` | Primeiros clientes |

## 4. O que evitar
- Inflar o catálogo com brindes comuns para parecer grande. Na TaMa, cada peça precisa justificar estar ali.
- Landing pages feitas só de imagem e PDFs/flipbooks no lugar de páginas, porque não indexam e pesam no celular.
- Pedir cadastro para enviar orçamento.
- Afirmações impossíveis de comprovar ("única do setor"), dependência de marcas licenciadas e logos de clientes sem autorização.
- Links quebrados e títulos duplicados. Os testes automatizados do projeto já verificam links internos.

## 5. Plano por fases

### Fase 1: base comercial (0–30 dias)
1. Domínio no ar, contatos reais, GA4 e Search Console (ver `DEPLOY.md` e `SEO.md`).
2. Fotografar as **8 peças em destaque** e trocar os ícones por fotos nas fichas.
3. Publicar 2 guias sazonais: fim de ano para clientes e Natal para colaboradores.
4. Criar `/ocasioes/fim-de-ano/` com a seleção da curadoria para fim de ano (11 peças hoje) e o guia.
5. Primeiro caso de cliente real, se houver autorização.

### Fase 2: vitrine e confiança (30–60 dias)
1. Fotos das demais peças. Páginas individuais só para as peças com foto e demanda comprovada no Search Console.
2. `/personalizacao/` com técnicas e fotos de amostras.
3. FAQ com números reais (mínimos, prazos, frete).
4. Lançar as duas linhas com nome nas fichas e nos serviços.
5. Um lookbook web de segmento, escolhido conforme os leads que chegarem.

### Fase 3: diferencial de serviço (60–90 dias)
1. **Proposta viva**: o n8n recebe o pedido, a TaMa monta a seleção e uma página privada é publicada para o cliente aprovar.
2. Hub de ocasiões completo (onboarding, eventos, reconhecimento, lançamentos).
3. Avaliar uma área recorrente para uniformes e kits de clientes fixos, só se houver demanda.

## 6. Como medir
| Indicador | Fonte | Meta inicial |
|---|---|---|
| Pedidos de proposta por mês | Netlify Forms / n8n | Linha de base no 1º mês |
| Taxa de conversão do formulário | GA4 (`form_start` → `form_submit_success`) | Acompanhar e otimizar |
| Pedidos com peças da curadoria | Campo `selecao` | Acima de 30% dos pedidos de brindes e kits |
| Cliques no WhatsApp | GA4 (`whatsapp_click`) | Acompanhar |
| Impressões e cliques para "brindes corporativos premium" e "kit corporativo personalizado" | Search Console | Crescimento mês a mês |
| Core Web Vitals de campo | Search Console | LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1 |
