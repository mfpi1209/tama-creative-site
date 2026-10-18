---
# Modelo para escrever um artigo sem o editor (/admin/). Copie para src/blog/endereco-do-artigo.md
# (o nome do arquivo vira a URL: /blog/endereco-do-artigo/). Passo a passo em docs/BLOG.md.
# YAML: textos com dois-pontos vão entre aspas.
title: 'Título do artigo: como aparece no H1 (até 110 caracteres)'
breadcrumb: Título curto
seo_title: 'Título para o Google, até 65 caracteres | TaMa'
description: Resumo de 70 a 160 caracteres. Aparece no Google.
resumo: Frase curta para o card da listagem e a linha abaixo do título (até 160 caracteres).
palavra_chave: consulta principal que o artigo responde
date: 2026-10-13
destaque: false
tema: brindes-e-presentes
ocasiao: fim-de-ano
servico: /kits-corporativos/
proposta: kits
capa: kit-presente
capa_alt: descrição do que aparece na foto, sem começar por "foto de".
capa_conceitual: true
# capa_legenda: Imagem ilustrativa · Marcas fictícias   # opcional
pecas:
- caderno-de-anotacoes
- garrafa-termica
- caneca
relacionados: []
# revisar_em: 2027-01-31          # opcional: próxima revisão (lei, valor ou dado que pode mudar)
# revisar_motivo: o que conferir   # opcional; exige revisar_em
draft: true
---

Abertura curta: o problema de quem lê e o que o guia vai resolver. Use a palavra-chave aqui.

## Primeira seção (Título 2: entra no sumário "Neste guia")

Texto em parágrafos curtos. Use **negrito** com moderação e [links internos](/kits-corporativos/).

### Subseção (Título 3)

- Itens de lista
- Outro item

[[cta]]

## Seção com um fato de fonte externa

Todo fato externo leva nota com a fonte.[^fonte-exemplo]

## Checklist rápido

- Item verificável
- Outro item

Fecho em uma ou duas frases.

[^fonte-exemplo]: Nome da norma ou do documento, artigo ou página. [Link oficial](https://www.planalto.gov.br/).
