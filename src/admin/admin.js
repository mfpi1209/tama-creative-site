/* Editor do blog TaMa Creative (Decap CMS): estilos da prévia, bloco "Chamada para proposta" e painel de SEO. */
(function () {
  'use strict';
  var CMS = window.CMS, h = window.h, createClass = window.createClass;
  if (!CMS) return;

  CMS.registerPreviewStyle('/admin/preview.css');

  function esc(s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
  function slugify(s) { return norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }

  /* [[cta]] / [[cta: texto]] no texto vira a chamada para a proposta no site */
  CMS.registerEditorComponent({
    id: 'cta',
    label: 'Chamada para proposta',
    fields: [{ name: 'texto', label: 'Texto da chamada (opcional; vazio usa o texto padrão)', widget: 'string', required: false }],
    pattern: /^\[\[cta(?::\s*(.*?))?\]\]$/,
    fromBlock: function (m) { return { texto: m[1] || '' }; },
    toBlock: function (d) { return d.texto ? '[[cta: ' + d.texto + ']]' : '[[cta]]'; },
    toPreview: function (d) {
      return '<aside class="post-callout"><p>' + esc(d.texto || 'Quer ajuda para transformar estas ideias em uma seleção com a sua marca? Conte a ocasião e a TaMa propõe as peças.') +
        '</p><span class="btn btn-wine">Solicitar proposta</span></aside>';
    }
  });

  var TEMAS = { 'brindes-e-presentes': 'Brindes e presentes', 'kits-e-boas-vindas': 'Kits e boas-vindas', 'planejamento-de-compras': 'Planejamento de compras',
    'personalizacao-e-materiais': 'Personalização e materiais', 'eventos-e-ativacoes': 'Eventos e ativações' };

  function check(ok, text) {
    return h('li', { style: { color: ok ? '#2F6B4F' : '#A4322A', margin: '2px 0' } }, (ok ? '✓ ' : '✗ ') + text);
  }

  var Preview = createClass({
    render: function () {
      var d = this.props.entry.get('data');
      var get = function (k) { var v = d.get(k); return v == null ? '' : String(v); };
      var title = get('title'), seo = get('seo_title') || title, desc = get('description'), kw = get('palavra_chave');
      var body = get('body');
      var firstPara = (body.split(/\n\s*\n/).filter(function (p) { return p.trim() && !/^#/.test(p.trim()); })[0] || '');
      var h2 = (body.match(/^##\s+\S/gm) || []).length;
      var words = body.replace(/\[\^[^\]]+\]:.*$/gm, '').split(/\s+/).filter(Boolean).length;
      var nk = norm(kw);
      var box = { border: '1px solid #E6DDD3', borderRadius: '8px', background: '#fff', padding: '18px 20px', margin: '0 0 28px', fontFamily: 'Arial, sans-serif' };
      return h('div', { style: { padding: '24px', background: '#FAF7F2' } },
        h('section', { style: box },
          h('p', { style: { margin: '0 0 10px', fontSize: '12px', letterSpacing: '.12em', textTransform: 'uppercase', color: '#6B625D' } }, 'Prévia no Google e checagem de SEO'),
          h('div', { style: { color: '#1a0dab', fontSize: '20px', lineHeight: '1.3' } }, seo || 'Título no Google'),
          h('div', { style: { color: '#006621', fontSize: '14px', margin: '2px 0 4px' } }, 'tamacreative.com.br › blog › ' + (slugify(get('breadcrumb')) || 'endereco-do-artigo')),
          h('div', { style: { color: '#4d5156', fontSize: '14px', lineHeight: '1.5' } }, desc || 'Descrição do artigo.'),
          h('ul', { style: { listStyle: 'none', padding: 0, margin: '14px 0 0', fontSize: '13px' } },
            check(seo.length >= 20 && seo.length <= 65, 'Título no Google com ' + seo.length + ' caracteres (ideal 20 a 65)'),
            check(desc.length >= 70 && desc.length <= 160, 'Descrição com ' + desc.length + ' caracteres (70 a 160)'),
            check(!!nk, 'Palavra-chave principal preenchida'),
            check(!!nk && norm(seo).indexOf(nk) !== -1, 'Palavra-chave no título do Google'),
            check(!!nk && norm(desc).indexOf(nk) !== -1, 'Palavra-chave na descrição'),
            check(!!nk && norm(firstPara).indexOf(nk) !== -1, 'Palavra-chave no primeiro parágrafo'),
            check(h2 >= 3, h2 + ' seções com Título 2 (recomendado: 3 ou mais)'),
            check(words >= 600, words + ' palavras (guias completos costumam passar de 600)'),
            check(/\[\[cta/.test(body), 'Chamada para proposta no meio do texto'),
            check(!!get('servico'), 'Página de serviço escolhida'),
            check(!!get('capa_alt'), 'Capa com descrição (texto alternativo)'))),
        h('article', { className: 'post' },
          h('header', { className: 'post-head' },
            h('p', { className: 'eyebrow' }, TEMAS[get('tema')] || 'Categoria'),
            h('h1', {}, title || 'Título do artigo'),
            h('p', { className: 'lead' }, desc)),
          h('div', { className: 'prose', style: { maxWidth: '44rem' } }, this.props.widgetFor('body'))));
    }
  });
  CMS.registerPreviewTemplate('blog', Preview);
})();
