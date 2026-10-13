// Disparada automaticamente pelo Netlify a cada envio verificado (já filtrado de spam) do formulário.
// Repassa o pedido ao n8n quando N8N_WEBHOOK_URL estiver configurada no Netlify (Site settings > Environment variables).
// Nada aqui fica exposto no navegador: a URL e o segredo vivem só no servidor.
//   N8N_WEBHOOK_URL     obrigatório para o repasse (ex.: https://seu-n8n/webhook/...)
//   N8N_WEBHOOK_SECRET  opcional; enviado no cabeçalho X-TaMa-Secret para o n8n validar a origem
const ALLOWED = ['nome', 'empresa', 'contato', 'tipo', 'quantidade', 'data', 'orcamento', 'objetivo', 'selecao', 'consentimento'];

export default async (req) => {
  const url = process.env.N8N_WEBHOOK_URL;
  let body;
  try {
    body = await req.json();
  } catch {
    return new Response('invalid payload', { status: 400 });
  }
  const p = body?.payload || {};
  if (p.form_name && p.form_name !== 'proposta') return new Response('ignored', { status: 200 });
  if (!url) {
    console.log('submission-created: N8N_WEBHOOK_URL não configurada; pedido ficou só no Netlify Forms.');
    return new Response('no webhook configured', { status: 200 });
  }
  const data = Object.fromEntries(ALLOWED.filter(k => p.data?.[k] !== undefined).map(k => [k, String(p.data[k]).slice(0, 4000)]));
  const out = {
    source: 'tamacreative-site',
    form: 'proposta',
    submission_id: p.id || null,
    created_at: p.created_at || new Date().toISOString(),
    site_url: p.site_url || null,
    data,
  };
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.N8N_WEBHOOK_SECRET) headers['X-TaMa-Secret'] = process.env.N8N_WEBHOOK_SECRET;
  try {
    const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(out), signal: AbortSignal.timeout(8000) });
    if (!r.ok) console.error(`submission-created: n8n respondeu ${r.status}`);
  } catch (err) {
    console.error('submission-created: falha ao chamar o n8n:', err?.message || err);
  }
  // O envio já foi registrado pelo Netlify Forms; falhas no n8n ficam no log da função.
  return new Response('ok', { status: 200 });
};
