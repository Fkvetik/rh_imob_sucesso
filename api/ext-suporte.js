// POST /api/ext-suporte  { token, telefone, assunto, texto, whatsapp_ok }
// Extensão › ❓ Ajuda › Chamar o suporte: todo pedido vira um lead no
// /painel → Leads (site_leads, no Novos Talentos), com o telefone que a pessoa
// informou e o diagnóstico da extensão. Assim o pedido aparece no painel mesmo
// quando a mensagem pelo WhatsApp do operador não sai.
import { cors, send, lerCorpo, validarSessao, NT } from './_ext-comum.js';

const limpa = (s, n) => String(s || '').replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim().slice(0, n);

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { ok: false });

  const b = await lerCorpo(req);
  const s = await validarSessao(b.token);
  if (!s.ok) return send(res, 401, { ok: false, error: s.error });

  const tel = String(b.telefone || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (tel.length < 10 || tel.length > 11) return send(res, 400, { ok: false, error: 'Informe um telefone com DDD.' });
  const service = NT.service();
  if (!service) return send(res, 500, { ok: false, error: 'Servidor sem configuração.' });

  const operador = limpa(s.nome_operador || s.login, 80);
  const r = await fetch(`${NT.url}/rest/v1/site_leads`, {
    method: 'POST',
    headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({
      // um pedido = um card (o painel junta linhas pelo prefixo antes do #)
      session_id: `suporte-${limpa(s.login, 40).replace(/[^a-z0-9._@-]/gi, '')}-${Date.now().toString(36)}#1`,
      nome: `${operador || 'Operador'} (suporte da extensão)`,
      whatsapp: tel,
      empresa: limpa(s.conta_nome || s.nome_conta, 80) || null,
      cargo_vaga: limpa(b.assunto, 120) || null,
      tipo: 'suporte_extensao',
      mensagem: limpa(b.texto, 3500),
      origem: 'Suporte da extensão' + (b.whatsapp_ok ? ' — também enviado pelo WhatsApp' : ' — não saiu pelo WhatsApp'),
      pagina: 'extensão RH IMOB Aceleradora',
      enviou_whatsapp: !!b.whatsapp_ok
    })
  }).catch(() => null);
  if (!r || !r.ok) return send(res, 502, { ok: false, error: 'Não consegui registrar o pedido agora.' });
  return send(res, 200, { ok: true });
}
