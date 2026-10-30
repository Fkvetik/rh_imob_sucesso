// Vercel Function — contatos do site para as páginas (lido por /contatos.js).
// Cache de 5 minutos na Vercel: o banco não é chamado a cada visita.
import { contatos } from './_contatos.js';

export default async function handler(req, res) {
  const c = await contatos();
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
  res.status(200).send(JSON.stringify(c));
}
