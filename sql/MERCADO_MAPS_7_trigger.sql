-- ============================================================================
-- MERCADO_MAPS_7 — trigger que NORMALIZA toda entrada nova (e atualização)
-- ----------------------------------------------------------------------------
-- POR QUE as novas entravam erradas: a ingestão gravava `cidade` como veio da
-- fonte (o Google às vezes manda o DISTRITO no lugar da cidade). O backfill
-- (MAPS_5/6) conserta o que já está no banco; este trigger conserta a ORIGEM:
-- a cada insert/update, ele re-deriva cidade/bairro/UF do ENDEREÇO (que termina
-- em "..., <Bairro>, <Cidade> - <UF>, <CEP>") e junta distritos de SP em "São
-- Paulo". Também mantém a extração de lat/lng da placeUrl (do MAPS_3).
--
-- Rode UMA vez no projeto RHI (Corretores): tnzmxpoxvdlckmjwdala
-- Substitui o trigger do MAPS_3 (trg_mercado_coords).
-- ============================================================================

create or replace function rhi_mercado_norm_trg()
returns trigger
language plpgsql
as $$
declare
  v_cid text;
  v_uf  text;
  v_bai text;
  v_cidn text; -- cidade minúscula sem acento (pra testar distritos de SP)
begin
  -- 1) Coordenadas da placeUrl (!3d<lat>!4d<lng>), se vierem sem coordenada.
  if (new.lat is null or new.lng is null) and new.place_url is not null then
    new.lat := coalesce(new.lat, nullif((regexp_match(new.place_url, '!3d(-?[0-9]+\.[0-9]+)'))[1], '')::double precision);
    new.lng := coalesce(new.lng, nullif((regexp_match(new.place_url, '!4d(-?[0-9]+\.[0-9]+)'))[1], '')::double precision);
  end if;

  -- 2) Cidade / bairro / UF a partir do endereço (fonte confiável).
  if new.endereco is not null and new.endereco ~ '-\s*[A-Za-z]{2}\s*,\s*\d{4,5}' then
    v_cid := (regexp_match(new.endereco, ',\s*([^,]+?)\s*-\s*[A-Za-z]{2}\s*,\s*\d{4,5}'))[1];
    v_uf  := upper((regexp_match(new.endereco, '-\s*([A-Za-z]{2})\s*,\s*\d{4,5}'))[1]);
    v_bai := (regexp_match(new.endereco, '[-,]\s*([^,\-]+?)\s*,\s*[^,]+?\s*-\s*[A-Za-z]{2}\s*,\s*\d'))[1];
    if v_cid is not null and btrim(v_cid) <> '' then new.cidade := btrim(v_cid); end if;
    if v_uf  is not null then new.uf := v_uf; end if;
    if v_bai is not null and btrim(v_bai) <> '' then new.bairro := btrim(v_bai); end if;
  end if;

  -- 3) Distritos de SP capital -> cidade "São Paulo" (o distrito vira o bairro).
  if new.uf = 'SP' and new.cidade is not null then
    v_cidn := translate(lower(new.cidade), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn');
    if v_cidn in (
      'republica','se','bela vista','consolacao','santa cecilia','bom retiro',
      'barra funda','higienopolis','vila buarque','centro historico de sao paulo',
      'campos eliseos','liberdade','cambuci','bras','pari','belem','mooca','agua rasa',
      'tatuape','belenzinho','vila carrao','artur alvim','ipiranga','sacoma',
      'jardim vergueiro (sacoma)','cursino','vila mariana','moema','saude','jabaquara',
      'vila olimpia','itaim bibi','jardim paulista','pinheiros','alto de pinheiros',
      'perdizes','lapa','butanta','morumbi','vila sonia','vila andrade','santo amaro',
      'campo belo','campo limpo','santana','tucuruvi','mandaqui','casa verde','limao',
      'freguesia do o','pirituba','itaquera','penha','vila prudente','jardim helena',
      'jardim myrna','jardim santa fe','vila barreto','parque industrial tomas edson',
      'zona oeste','zona leste','zona norte','zona sul'
    ) then
      new.bairro := coalesce(nullif(btrim(new.bairro), ''), new.cidade);
      new.cidade := 'São Paulo';
    end if;
  end if;

  return new;
end;
$$;

-- Substitui o trigger antigo (que só fazia coordenada) por este completo.
drop trigger if exists trg_mercado_coords on rhi_mercado_maps;
drop trigger if exists trg_mercado_norm   on rhi_mercado_maps;
create trigger trg_mercado_norm
  before insert or update on rhi_mercado_maps
  for each row execute function rhi_mercado_norm_trg();

-- Reaplica nas linhas existentes de uma vez (dispara o trigger em todas):
-- update rhi_mercado_maps set endereco = endereco;
