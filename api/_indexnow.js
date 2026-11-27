// IndexNow — avisa os buscadores (Bing, Yandex e parceiros) na HORA que uma
// página é criada ou alterada, em vez de esperar o robô passar sozinho.
// É um protocolo aberto: basta um POST com a lista de URLs + uma chave pública
// hospedada no próprio site (o arquivo <KEY>.txt na raiz prova que o site é
// nosso). Não precisa de conta nem login.
//
// Uso: import { pingIndexNow } from './_indexnow.js'; await pingIndexNow([url1, url2]);
// É best-effort: nunca lança erro pra não travar o fluxo de salvar a vaga.

const HOST = 'www.rhimob.com.br';
const KEY  = '3385998af38f53104bee80f8e433f096';            // = nome do arquivo em /<KEY>.txt
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;

export async function pingIndexNow(urls) {
  try {
    const lista = (Array.isArray(urls) ? urls : [urls])
      .map(u => String(u || '').trim())
      .filter(u => /^https:\/\/www\.rhimob\.com\.br\//.test(u)); // só do próprio site
    if (!lista.length) return { ok: false, motivo: 'sem urls' };

    const r = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList: lista })
    });
    // 200 e 202 = aceito. Qualquer outra coisa não quebra nada aqui.
    return { ok: r.ok, status: r.status, enviados: lista.length };
  } catch (e) {
    return { ok: false, erro: String(e && e.message || e) };
  }
}
