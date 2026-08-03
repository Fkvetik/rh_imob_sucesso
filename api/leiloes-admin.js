// Vercel Function — painel interno de Leilões: lista os 40 imóveis publicados
// em /leiloes com o responsável (leiloeiro) por trás de cada um — site,
// telefone, Instagram e endereço, cruzados via domínio contra uma base de
// contatos (Google Maps) fornecida pelo usuário. Não é exposto ao público —
// as páginas de /leilao* continuam sem link do leiloeiro, de propósito.
//
// GET /api/leiloes-admin?token=SEU_TOKEN → { ok, itens }
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DB = JSON.parse(readFileSync(join(process.cwd(), 'data/leiloes-admin.json'), 'utf8'));

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const token = req.query.token || '';
  const ADMIN_TOKEN = process.env.LEADS_ADMIN_TOKEN;
  if (!ADMIN_TOKEN) return res.status(500).send(JSON.stringify({ error: 'config', message: 'Falta LEADS_ADMIN_TOKEN na Vercel.' }));
  if (token !== ADMIN_TOKEN) return res.status(401).send(JSON.stringify({ error: 'auth', message: 'Token inválido.' }));

  res.status(200).send(JSON.stringify({ ok: true, itens: DB }));
}
