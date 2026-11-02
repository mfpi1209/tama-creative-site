# Especificação visual — proposta 01

## Autoridade e escala
Referência: referencia/home-aprovada.png. É mockup raster gerado, não fonte Figma. Sua proporção deve orientar o conjunto; números abaixo são valores definidos para reprodução, não leitura exata do CSS original. Base desktop: viewport 1440 px, container 1340 px, margens 50 px; em telas menores usar 24 px e no celular 20 px. Sem zoom ou transform para simular tamanho.

## Cores e tipografia
Fundo #FAF7F2; superfície #FCF9F5; areia #F1E9DE; bordô #521B2C; verde #183C29; carvão #27221F; texto #292321; secundário #71675F; linha #E5DCD3; coral ornamental #C96751. Usar logo oficial original do projeto.
Títulos: primeiro a fonte serif existente compatível. Alternativa aproximada: Cormorant Garamond 500/600; corpo: fonte sans existente compatível, alternativa DM Sans 400/500/600. Fontes alternativas não estão incluídas nem são comprovadas como as do mockup. Carregar localmente ou pelo mecanismo existente, sem @import bloqueante.
Hero h1 64/64 px, tracking -0.025em, largura 610 px; segunda linha em itálico bordô. H2 48/52 px, tracking -0.025em. Card h3 32/34 px. Corpo 16/25; link 15/22 semibold; nav 14/20; eyebrow 12/18, tracking .12em. Até 767: h1 42/44, h2 34/38, h3 26/30; corpo 16/25. Manter contraste, nunca reduzir texto para caber.

## Estrutura desktop e espaços
Faixa utilitária 28 px; header 64 px; navegação 42 px. Busca largura flexível até 620 px; CTA 44 px de altura, raio 999 px. Ícones de interface 20 px.
Hero: altura inicial 560 px; conteúdo em duas colunas 48%/52%; texto à esquerda com padding 50 px, fotografia à direita. Usar hero.png como imagem, object-fit cover, object-position 66% center; fade CSS areia na borda esquerda da imagem, sem cobrir os produtos. Título e CTA reais no lado esquerdo; sem duplicar texto dentro da foto. Fundo #F1E9DE.
Faixa soluções: padding vertical 40 px; título 285 px de largura, divisor vertical sutil; cinco itens flex iguais, ícones 44 px e labels 15/19 px centrados, gap 12 px. Brindes corporativos / Uniformes e confecções / Kits corporativos / Eventos corporativos / Hotelaria e gastronomia. Sem descrições longas nem fotos.
Catálogo: padding-top 56, padding-bottom 56; h2 e subtítulo com gap 10; filtros após 24, grade após 30; 3 colunas iguais, gap 24 px horizontal/vertical. Card sem sombra, border 1px linha, radius 6, overflow hidden. Área da foto aspecto 1.1, object-fit cover; object-position center inicialmente. Ajustar recorte se cortar produto, nunca distorcer. Rodapé do card padding 20 px 24 px; nome e link gap 10. Sem texto sobre a foto. Filtro pill altura 34, padding horizontal 22; ativo bordô, texto claro. Hover sutil 180ms: borda bordô e imagem scale(1.02) apenas dentro do frame, sem mover layout. Foco visível de 2 px.
Cards na ordem: kits/garrafas/canecas, cadernos/ecobags/vestuario. Tags locais se necessárias: kits=[kits], dia-a-dia=[garrafas,canecas,cadernos,ecobags], vestuario=[vestuario]. Todos mostra seis. Não usar “mais vendidos” sem dado real.
Processo: faixa areia, radius 12, padding 32; título à esquerda, 6 etapas iguais: 01 Briefing, 02 Curadoria, 03 Proposta, 04 Aprovação, 05 Produção, 06 Entrega. Círculos claros 44px com numeral bordô, separadores chevron. Não misturar com etapas técnicas de desenvolvimento.
FAQ: margin-top 64; título e texto de apoio, lista em duas colunas com divisor central, linhas inferiores, padding 20 px por pergunta e ícone mais. Texto real do projeto tem prioridade sobre letras ilegíveis da referência. Perguntas: O que a TaMa faz? / Posso personalizar as peças nas cores da minha marca? / Vocês montam kits completos? / Existe quantidade mínima? / Qual é o prazo? / Como funciona a aprovação da arte?
Guias: padding-top 56, padding-bottom 64; três colunas gap 24; foto 16/9 e título abaixo com padding 20. guia-fim-de-ano: Brindes de fim de ano para clientes; guia-boas-vindas: O que colocar no kit de boas-vindas; guia-compliance: Brindes e compliance. Kicker GUIA e link Ler o guia →.
CTA: bordô sólido, padding vertical 52; título branco 48/52, subtítulo 16/24 e dois botões centralizados com gap 16, margin-top 24. Solicitar proposta (creme) / Conversar no WhatsApp (outline claro).
Rodapé: carvão sólido, padding 48 px 0 24; logo e descrição à esquerda, quatro colunas menores com dados reais. Linha inferior e copyright. Usar ano dinâmico. Não copiar contatos possivelmente inventados ou artefatos tipográficos do mockup.

## Responsividade
>=1200: container min(1340px, calc(100% - 100px)); 768–1199: 48px de margem total e catálogo 2 colunas; 480–767: 40px de margem total e 2 colunas; <=479: 40px margem total e 1 coluna. No celular filtros com quebra de linha, header adaptado com menu/busca acessíveis, utilitário secundário pode ficar oculto. Soluções grade de 2 colunas, título em largura total; processo 2 colunas por 3 linhas; guias 1 coluna; footer empilhado. Não há mockup móvel aprovado: essas regras são uma adaptação proposta.

## Integridade dos elementos
Usar o logo oficial do repositório; nunca recriar a marca por digitação. Os SVGs do pacote são elementos auxiliares. Textos, divisores, círculos, botões, pills, cards e fundos são HTML/CSS. Não necessitam PNG. Pétala aproximada apenas como ornamento se não houver asset oficial. Fotos ilustrativas não comprovam disponibilidade do modelo; preservar a política real do catálogo.
