/***** MERCADO POR REGIÃO — alimentação da base a partir da planilha do Maps *****
 *
 * Cole este arquivo no editor do Apps Script do Web App que você já usa (o mesmo
 * que roda no Google Maps: CENTRAL -> COLETA -> TRATADOS). Ele NÃO mexe no que
 * você já tem; só adiciona o "espelho" para o banco.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * PASSO 1 — guardar o segredo e a URL (uma vez só).
 *   No editor: Configurações do projeto ▸ Propriedades do script ▸ Adicionar:
 *     MERCADO_INGEST_URL     = https://www.rhimob.com.br/api/mercado-ingest
 *     MERCADO_INGEST_SECRET  = (o MESMO valor que está no Vercel; ver LEIA abaixo)
 *   O segredo NÃO fica no código nem na planilha — só aqui, nas propriedades.
 *
 * PASSO 2 — ligar na alimentação ao vivo (2 linhas nas suas funções):
 *   • Dentro de upsertLinks_ (CENTRAL), depois de gravar os links novos, chame:
 *         mercadoOnCentral_(linhasNovas);   // linhasNovas = array de objetos {href,cardName,cardPhone,cardStatus,...}
 *   • Dentro de appendColetaAndMark_ (COLETA), depois de montar a linha coletada:
 *         mercadoOnColeta_(linhasColetadas); // array de objetos {placeUrl,nome,fone_maps,endereco,...}
 *   (Se preferir, me diga e eu encaixo essas chamadas no seu código.)
 *
 * PASSO 3 — carregar o histórico de uma vez:
 *   No editor, selecione a função mercadoBackfillTratados e clique ▶ Executar.
 *   Ela lê a aba TRATADOS inteira e manda em lotes. Pode rodar quantas vezes
 *   quiser — é upsert, não duplica.
 * ─────────────────────────────────────────────────────────────────────────── */

var MERCADO_BATCH = 150;

/** Chave de dedup: usa a sua normPlaceUrl_ se existir; senão, normaliza aqui. */
function mercadoPlaceKey_(url) {
  url = String(url || '').trim();
  if (!url) return '';
  try { if (typeof normPlaceUrl_ === 'function') return normPlaceUrl_(url); } catch (e) {}
  // Fallback: tenta o par hexadecimal do lugar (0x..:0x..); senão, a URL sem query.
  var m = url.match(/0x[0-9a-f]+:0x[0-9a-f]+/i);
  if (m) return m[0].toLowerCase();
  return url.split(/[?#]/)[0].replace(/\/+$/, '').toLowerCase();
}

/** POST servidor-para-servidor para o /api/mercado-ingest, em lotes. */
function mercadoIngest_(estagio, rows) {
  rows = (rows || []).filter(function (r) { return r && r.place_key; });
  if (!rows.length) return { ok: true, gravados: 0 };
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('MERCADO_INGEST_URL');
  var segredo = props.getProperty('MERCADO_INGEST_SECRET');
  if (!url || !segredo) throw new Error('Configure MERCADO_INGEST_URL e MERCADO_INGEST_SECRET nas Propriedades do script.');

  var total = 0;
  for (var i = 0; i < rows.length; i += MERCADO_BATCH) {
    var lote = rows.slice(i, i + MERCADO_BATCH);
    var resp = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ segredo: segredo, estagio: estagio, rows: lote }),
      muteHttpExceptions: true
    });
    var code = resp.getResponseCode();
    var body = {};
    try { body = JSON.parse(resp.getContentText()); } catch (e) {}
    if (code >= 200 && code < 300 && body.ok) {
      total += (body.gravados || 0);
    } else {
      Logger.log('mercadoIngest_ falhou (' + code + '): ' + resp.getContentText());
      throw new Error('mercado-ingest HTTP ' + code + ' — ' + (body.error || resp.getContentText()).slice(0, 200));
    }
    Utilities.sleep(200); // gentil com o servidor
  }
  Logger.log('mercadoIngest_ [' + estagio + '] gravados=' + total + ' de ' + rows.length);
  return { ok: true, gravados: total };
}

/** CENTRAL -> registro parcial. objs: array de linhas da central (por cabeçalho). */
function mercadoOnCentral_(objs) {
  var rows = (objs || []).map(function (o) {
    o = o || {};
    return {
      place_key: mercadoPlaceKey_(o.href || o.placeUrl || o.url),
      place_url: o.href || o.placeUrl || o.url || '',
      nome:      o.cardName || o.nome || '',
      telefone:  o.cardPhone || o.fone_maps || '',
      status:    o.cardStatus || o.state || o.status || ''
    };
  });
  try { return mercadoIngest_('central', rows); }
  catch (e) { Logger.log('mercadoOnCentral_: ' + e); return { ok: false, error: String(e) }; }
}

/** COLETA/TRATADOS -> registro completo. objs: array de linhas (por cabeçalho). */
function mercadoOnColeta_(objs) {
  var rows = (objs || []).map(mercadoLinhaColeta_);
  try { return mercadoIngest_('coleta', rows); }
  catch (e) { Logger.log('mercadoOnColeta_: ' + e); return { ok: false, error: String(e) }; }
}

/** Mapeia uma linha da aba Coleta/TRATADOS (chaveada pelo cabeçalho) no formato do banco. */
function mercadoLinhaColeta_(o) {
  o = o || {};
  var url = o.placeUrl || o.href || '';
  return {
    place_key:      mercadoPlaceKey_(url),
    place_url:      url,
    nome:           o.nome || o.NOME_INSTAGRAM || '',
    categoria:      o.CATEGORIA_MAPS || o.CATEGORIA_INSTAGRAM || '',
    tipo_local:     o.tipo_local || '',
    telefone:       o.fone_maps || o.TEL_INSTAGRAM || o.FONE_INSTAGRAM || '',
    endereco:       o.endereco || '',
    cidade:         o.Cidade || o.cidade || '',
    site:           o.site_maps || '',
    instagram_url:  o.instagramUrl || '',
    instagram_user: o.igUsername || '',
    seguidores:     o.SEGUIDORES || '',
    avaliacao:      o.avaliacao || '',
    num_avaliacoes: o.num_avaliacoes || '',
    creci:          o.CRECI || o.CRECI_INSTAGRAM || '',
    status:         o.status || ''
  };
}

/** Lê uma aba inteira como array de objetos {cabeçalho: valor}. */
function mercadoLerAba_(nomeAba) {
  var sh = SpreadsheetApp.getActive().getSheetByName(nomeAba);
  if (!sh) throw new Error('Aba não encontrada: ' + nomeAba);
  var val = sh.getDataRange().getValues();
  if (val.length < 2) return [];
  var head = val[0].map(function (h) { return String(h || '').trim(); });
  var out = [];
  for (var i = 1; i < val.length; i++) {
    var o = {}, vazia = true;
    for (var c = 0; c < head.length; c++) {
      if (!head[c]) continue;
      var v = val[i][c];
      o[head[c]] = v;
      if (v !== '' && v != null) vazia = false;
    }
    if (!vazia) out.push(o);
  }
  return out;
}

/** BACKFILL do histórico: lê a aba TRATADOS e manda tudo. Rode manualmente. */
function mercadoBackfillTratados() {
  var objs = mercadoLerAba_('TRATADOS');
  var rows = objs.map(mercadoLinhaColeta_).filter(function (r) { return r.place_key; });
  var r = mercadoIngest_('coleta', rows);
  Logger.log('BACKFILL TRATADOS: ' + rows.length + ' linhas enviadas, ' + r.gravados + ' gravadas.');
  return r;
}

/** BACKFILL opcional da aba Coleta (caso tenha linhas que ainda não foram para TRATADOS). */
function mercadoBackfillColeta() {
  var objs = mercadoLerAba_('Coleta');
  var rows = objs.map(mercadoLinhaColeta_).filter(function (r) { return r.place_key; });
  var r = mercadoIngest_('coleta', rows);
  Logger.log('BACKFILL Coleta: ' + rows.length + ' linhas enviadas, ' + r.gravados + ' gravadas.');
  return r;
}

/** Teste rápido: manda 1 linha fake e confere a resposta. */
function mercadoTesteConexao() {
  var r = mercadoIngest_('coleta', [{
    place_key: 'teste:conexao',
    place_url: 'https://www.google.com/maps/@-23.561,-46.656,17z',
    nome: 'Teste conexão', cidade: 'São Paulo'
  }]);
  Logger.log(JSON.stringify(r));
  return r;
}
