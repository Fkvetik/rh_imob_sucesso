-- RH IMOB CRM V11 — limpeza de duplicidades em crm_mensagens
-- Mantém uma mensagem por: operation + telefone_norm + direction + texto normalizado + minuto.

create extension if not exists pgcrypto;
create extension if not exists unaccent;

alter table if exists public.crm_mensagens
  add column if not exists dedup_minuto text;

update public.crm_mensagens
set dedup_minuto = to_char(date_trunc('minute', coalesce(message_at, created_at)), 'YYYYMMDDHH24MI')
where dedup_minuto is null;

with marcadas as (
  select
    id,
    row_number() over (
      partition by
        operation,
        telefone_norm,
        upper(coalesce(direction,'')),
        regexp_replace(lower(unaccent(coalesce(message_text,''))), '\s+', ' ', 'g'),
        to_char(date_trunc('minute', coalesce(message_at, created_at)), 'YYYYMMDDHH24MI')
      order by coalesce(message_at, created_at) asc, created_at asc, id asc
    ) as rn
  from public.crm_mensagens
)
delete from public.crm_mensagens m
using marcadas d
where m.id = d.id
  and d.rn > 1;

create or replace function public.rpc_crm_limpar_duplicidades_mensagens()
returns jsonb
language plpgsql
security definer
as $$
declare
  v_apagadas integer := 0;
begin
  with marcadas as (
    select
      id,
      row_number() over (
        partition by
          operation,
          telefone_norm,
          upper(coalesce(direction,'')),
          regexp_replace(lower(unaccent(coalesce(message_text,''))), '\s+', ' ', 'g'),
          to_char(date_trunc('minute', coalesce(message_at, created_at)), 'YYYYMMDDHH24MI')
        order by coalesce(message_at, created_at) asc, created_at asc, id asc
      ) as rn
    from public.crm_mensagens
  ), apagadas as (
    delete from public.crm_mensagens m
    using marcadas d
    where m.id = d.id and d.rn > 1
    returning m.id
  )
  select count(*) into v_apagadas from apagadas;

  return jsonb_build_object('ok', true, 'apagadas', v_apagadas, 'gerado_em', now());
end;
$$;

select public.rpc_crm_limpar_duplicidades_mensagens();
