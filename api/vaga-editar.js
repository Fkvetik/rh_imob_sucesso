// Vercel Function — edição da vaga PELO DONO (auto-serviço).
// A Mariana manda o link /editar-vaga?v=<vaga_id>&t=<edit_token> pro dono da
// vaga. Aqui a autorização é o edit_token DAQUELA vaga (não o token-mestre do
// admin): o dono edita só o conteúdo da própria vaga e publica direto.
//
// GET  ?v=<vaga_id>&t=<token>        → { ok, vaga }  (campos de conteúdo)
// POST { vaga_id, edit_token, ...}   → grava o conteúdo (status/grade/prioridade
//                                       NÃO mudam aqui — isso é só no admin)

import { pingIndexNow } from './_indexnow.js';

const SB_URL = 'https://pufxvskozfdvfscqnays.supabase.co';
const TABELA = 'site_vagas_publicas';

// Só conteúdo. Nada de status, na_grade, prioridade, edit_token, vaga_id.
const CAMPOS = [
  'titulo', 'categoria', 'selo', 'localidade', 'cidade', 'estado_uf', 'modalidade',
  'remuneracao', 'horario', 'resumo', 'destaques', 'sobre_empresa', 'detalhes',
  'requisitos', 'atividades',
  'imagem_url', 'imagem_og', 'instagram_url', 'midia_tipo', 'pdf_url', 'pdf_label',
  'responsavel_nome', 'responsavel_whatsapp', 'responsavel_empresa',
  'responsavel_cargo', 'responsavel_email', 'responsavel_foto_url'
];

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SERVICE_KEY) return send(res, 500, { error: 'config', message: 'Configuração ausente no servidor.' });
  const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const vagaId = String(body.vaga_id || '').trim();
      const token = String(body.edit_token || '').trim();
      const vaga = await validar(headers, vagaId, token);
      if (!vaga) return send(res, 401, { error: 'auth', message: 'Link inválido ou expirado. Peça um novo à RH IMOB.' });

      const patch = { updated_at: new Date().toISOString() };
      CAMPOS.forEach(c => { if (body[c] !== undefined) patch[c] = body[c] == null ? '' : body[c]; });
      if (patch.estado_uf) patch.estado_uf = String(patch.estado_uf).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
      if (!patch.titulo && patch.titulo !== undefined) return send(res, 400, { error: 'validacao', message: 'O título não pode ficar vazio.' });

      const r = await fetch(`${SB_URL}/rest/v1/${TABELA}?vaga_id=eq.${encodeURIComponent(vagaId)}`, {
        method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify(patch)
      });
      if (!r.ok) return supabaseErr(res, r);
      // Foto segue o responsável: se o dono salvou foto, aplica a todas as vagas
      // com o mesmo telefone (o do patch, ou o que já estava na vaga).
      const foto = patch.responsavel_foto_url;
      const tel = String(patch.responsavel_whatsapp || vaga.responsavel_whatsapp || '').trim();
      if (foto && tel) {
        try {
          await fetch(`${SB_URL}/rest/v1/${TABELA}?responsavel_whatsapp=eq.${encodeURIComponent(tel)}`, {
            method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' },
            body: JSON.stringify({ responsavel_foto_url: foto })
          });
        } catch (_) {}
      }
      await pingIndexNow(`https://www.rhimob.com.br/vaga/${vagaId}`); // dono publicou → avisa buscadores
      return send(res, 200, { ok: true });
    }

    // GET → devolve os dados pra página do dono preencher
    const vagaId = String(req.query.v || '').trim();
    const token = String(req.query.t || '').trim();
    const vaga = await validar(headers, vagaId, token);
    if (!vaga) return send(res, 401, { error: 'auth', message: 'Link inválido ou expirado. Peça um novo à RH IMOB.' });
    delete vaga.edit_token; // o dono não precisa ver o segredo
    return send(res, 200, { ok: true, vaga });
  } catch (e) {
    return send(res, 500, { error: 'exception', message: String(e && e.message || e) });
  }
}

async function validar(headers, vagaId, token) {
  if (!vagaId || !token) return null;
  const r = await fetch(`${SB_URL}/rest/v1/${TABELA}?select=*&vaga_id=eq.${encodeURIComponent(vagaId)}&limit=1`, { headers });
  if (!r.ok) return null;
  const linhas = await r.json();
  const v = Array.isArray(linhas) && linhas[0];
  if (!v || !v.edit_token || v.edit_token !== token) return null;
  return v;
}

function send(res, status, obj) { res.status(status).send(JSON.stringify(obj)); }
async function supabaseErr(res, r) {
  const t = await r.text().catch(() => '');
  return send(res, 502, { error: 'supabase', status: r.status, message: t.slice(0, 400) });
}
