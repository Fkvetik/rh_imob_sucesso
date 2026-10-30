// POST /api/push-enviar — entrega os avisos novos como notificação no celular.
// Chamado logo depois de um clique no site, pelo admin depois de aprovar e,
// de garantia, pelo cron da Vercel. Não recebe dados: só manda o que o banco
// tem pendente, então pode ser chamado por qualquer um sem risco.
import { cors, send } from './_ext-comum.js';
import { enviarPendentes } from './_push.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  try {
    return send(res, 200, await enviarPendentes());
  } catch (e) {
    return send(res, 200, { ok: false });
  }
}
