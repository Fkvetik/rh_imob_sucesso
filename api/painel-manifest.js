// GET /api/painel-manifest?k=site|parceiro&t=TOKEN
// Manifesto do aplicativo do painel. Cada painel tem o seu (o link de edição
// é pessoal), então o ícone instalado abre direto no painel da pessoa.
export default function handler(req, res) {
  const k = req.query.k === 'parceiro' ? 'parceiro' : 'site';
  const t = String(req.query.t || '').replace(/[^a-f0-9]/g, '').slice(0, 80);
  const start = (k === 'parceiro' ? '/parceiro' : '/meu-site') + (t ? '?t=' + t : '');
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).send(JSON.stringify({
    id: start,
    name: k === 'parceiro' ? 'Painel do parceiro RH IMOB' : 'Meu site RH IMOB',
    short_name: 'RH IMOB',
    description: 'Painel da Rede de Parceiros RH IMOB: seus imóveis, avisos e contatos.',
    start_url: start,
    scope: '/',
    display: 'standalone',
    background_color: '#f7f4fb',
    theme_color: '#2b124d',
    lang: 'pt-BR',
    icons: [
      { src: '/assets/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/assets/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }
    ]
  }));
}
