// POST /api/site-clique  { c, n, onde, rede, titulo, sid, pagina }
// Site do corretor: cada clique num botão de WhatsApp vira
//  1) um clique contado no Coletor (rpc_site_clique, SQL REDE_1), para o admin
//     ver quais empreendimentos da rede geram interesse;
//  2) um lead no /painel → Leads (site_leads, no Novos Talentos), com o site,
//     o imóvel e o profissional que recebeu o contato. O WhatsApp de quem
//     clicou não chega até nós (a conversa abre direto no celular do
//     profissional), então o lead fica sem telefone.
import { cors, send, lerCorpo, COLETOR, NT } from './_ext-comum.js';

const ONDE = { PERFIL: 'botão do perfil', IMOVEL: 'imóvel do profissional', REDE: 'lançamento da rede RH IMOB', VAGA: 'vaga para corretores' };
const limpa = (s, n) => String(s || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { ok: false });

  const b = await lerCorpo(req);
  const c = limpa(b.c, 80).toLowerCase().replace(/[^a-z0-9-]/g, '');
  const n = limpa(b.n, 80).toLowerCase().replace(/[^a-z0-9-]/g, '');
  const onde = ONDE[String(b.onde || '').toUpperCase()] ? String(b.onde).toUpperCase() : 'PERFIL';
  const rede = /^\d{1,12}$/.test(String(b.rede || '')) ? Number(b.rede) : null;
  if (!c || !n) return send(res, 400, { ok: false });

  try {
    const s = await fetch(`${COLETOR.url}/rest/v1/rpc/rpc_site_clique`, {
      method: 'POST',
      headers: { apikey: COLETOR.anon, Authorization: `Bearer ${COLETOR.anon}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_cidade: c, p_nome: n, p_onde: onde, p_rede_id: rede })
    }).then(r => r.json()).catch(() => null);
    if (!s || !s.ok) return send(res, 200, { ok: false }); // rascunho ou banco sem o REDE_1: não conta

    const service = NT.service();
    if (service) {
      const titulo = limpa(s.rede_titulo || b.titulo, 80);
      const telProf = String(s.telefone || '').replace(/\D/g, '').replace(/^55/, '');
      const telFmt = telProf.length >= 10 ? `(${telProf.slice(0, 2)}) ${telProf.slice(2, -4)}-${telProf.slice(-4)}` : telProf;
      // sid: um por visitante (sessionStorage); o painel junta os cliques da mesma visita
      const sid = 'sitecor-' + (limpa(b.sid, 40).replace(/[^a-z0-9]/gi, '') || Math.random().toString(36).slice(2, 10));
      await fetch(`${NT.url}/rest/v1/site_leads`, {
        method: 'POST',
        headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({
          session_id: `${sid}#${Date.now().toString(36)}`,
          nome: `Visitante do site de ${s.nome}`,
          empresa: s.nome,
          cidade: s.cidade,
          cargo_vaga: titulo || null,
          tipo: 'site_corretor',
          mensagem: `Clicou no WhatsApp (${ONDE[onde]}${titulo ? ': ' + titulo : ''}${s.construtora ? ' — ' + s.construtora : ''}). A conversa abriu direto no WhatsApp de ${s.nome}${telFmt ? ' ' + telFmt : ''}.`,
          origem: `Site do corretor — ${ONDE[onde]}`,
          pagina: limpa(b.pagina, 300) || `https://www.rhimob.com.br/corretor/${c}/${n}`,
          enviou_whatsapp: true
        })
      }).catch(() => {});
    }
    return send(res, 200, { ok: true });
  } catch (e) {
    return send(res, 200, { ok: false });
  }
}
