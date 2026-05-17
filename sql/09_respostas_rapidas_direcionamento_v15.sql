-- =========================================================
-- RH IMOB CRM V15 — Mensagens rápidas editáveis + direcionamento de operador
-- Execute no Supabase SQL Editor.
-- =========================================================

create extension if not exists pgcrypto;

-- 1) Mensagens rápidas persistentes por operação
create table if not exists public.crm_respostas_rapidas (
  id uuid primary key default gen_random_uuid(),
  operation text not null,
  titulo text not null,
  texto text not null default '',
  ativo boolean not null default true,
  ordem integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(operation, titulo)
);

alter table public.crm_respostas_rapidas add column if not exists tipo_acao text not null default 'MENSAGEM_LEAD';
alter table public.crm_respostas_rapidas add column if not exists operador_destino_nome text;
alter table public.crm_respostas_rapidas add column if not exists operador_destino_telefone text;
alter table public.crm_respostas_rapidas add column if not exists operador_destino_funcao text;
alter table public.crm_respostas_rapidas add column if not exists texto_operador text;
alter table public.crm_respostas_rapidas add column if not exists updated_at timestamptz not null default now();

create or replace function public.crm_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_crm_respostas_rapidas_updated_at on public.crm_respostas_rapidas;
create trigger trg_crm_respostas_rapidas_updated_at
before update on public.crm_respostas_rapidas
for each row execute function public.crm_set_updated_at();

create index if not exists idx_crm_respostas_rapidas_operation_ordem on public.crm_respostas_rapidas(operation, ativo, ordem);

-- 2) Função para salvar tudo o que foi editado na tela, sem voltar para padrão antigo
create or replace function public.rpc_crm_salvar_respostas_rapidas(
  p_operation text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_item jsonb;
  v_count integer := 0;
  v_title text;
begin
  if coalesce(trim(p_operation), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'operation vazio');
  end if;

  delete from public.crm_respostas_rapidas where operation = p_operation;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_count := v_count + 1;
    v_title := coalesce(nullif(trim(v_item->>'titulo'), ''), nullif(trim(v_item->>'title'), ''), 'Mensagem ' || v_count::text);

    insert into public.crm_respostas_rapidas(
      operation,
      titulo,
      texto,
      tipo_acao,
      operador_destino_nome,
      operador_destino_telefone,
      operador_destino_funcao,
      texto_operador,
      ativo,
      ordem
    ) values (
      p_operation,
      v_title,
      coalesce(v_item->>'texto', v_item->>'text', ''),
      coalesce(nullif(v_item->>'tipo_acao',''), nullif(v_item->>'action',''), 'MENSAGEM_LEAD'),
      coalesce(v_item->>'operador_destino_nome', v_item->>'operatorName', ''),
      regexp_replace(coalesce(v_item->>'operador_destino_telefone', v_item->>'operatorPhone', ''), '\\D', '', 'g'),
      coalesce(v_item->>'operador_destino_funcao', v_item->>'operatorRole', ''),
      coalesce(v_item->>'texto_operador', v_item->>'operatorText', ''),
      coalesce((v_item->>'ativo')::boolean, (v_item->>'active')::boolean, true),
      coalesce((v_item->>'ordem')::integer, v_count * 10)
    );
  end loop;

  return jsonb_build_object('ok', true, 'operation', p_operation, 'saved', v_count);
end;
$$;

-- 3) crm_outbox passa a aceitar mensagem para lead e direcionamento para operador
alter table public.crm_outbox add column if not exists destino_tipo text not null default 'LEAD';
alter table public.crm_outbox add column if not exists lead_telefone_norm text;
alter table public.crm_outbox add column if not exists operador_destino_nome text;
alter table public.crm_outbox add column if not exists operador_destino_funcao text;
alter table public.crm_outbox add column if not exists origem text default 'CRM_SITE';
alter table public.crm_outbox add column if not exists source text default 'CRM_SITE';
alter table public.crm_outbox add column if not exists external_id text;
alter table public.crm_outbox add column if not exists status text default 'PENDENTE';
alter table public.crm_outbox add column if not exists status_envio text default 'PENDENTE';
alter table public.crm_outbox add column if not exists raw_payload jsonb default '{}'::jsonb;
alter table public.crm_outbox add column if not exists attempts integer default 0;

update public.crm_outbox
set destino_tipo = coalesce(destino_tipo, 'LEAD'),
    origem = coalesce(origem, 'CRM_SITE'),
    source = coalesce(source, origem, 'CRM_SITE'),
    status = coalesce(status, 'PENDENTE'),
    status_envio = coalesce(status_envio, 'PENDENTE'),
    raw_payload = coalesce(raw_payload, '{}'::jsonb),
    attempts = coalesce(attempts, 0)
where destino_tipo is null or origem is null or source is null or status is null or status_envio is null or raw_payload is null or attempts is null;

-- 4) Recriar view de pendentes com as colunas novas
DROP VIEW IF EXISTS public.vw_crm_outbox_pendentes;
create view public.vw_crm_outbox_pendentes as
select
  id,
  operation,
  telefone_norm,
  telefone_display,
  message_text,
  operador,
  status,
  status_envio,
  origem,
  source,
  destino_tipo,
  lead_telefone_norm,
  operador_destino_nome,
  operador_destino_funcao,
  external_id,
  attempts,
  last_error,
  processando_em,
  enviado_em,
  created_at,
  updated_at,
  raw_payload
from public.crm_outbox
where coalesce(status, 'PENDENTE') in ('PENDENTE', 'ERRO')
  and coalesce(status_envio, 'PENDENTE') in ('PENDENTE', 'ERRO')
  and coalesce(attempts, 0) < 5
order by created_at asc;

-- 5) Recriar função de enfileirar resposta preservando raw_payload e direção
DROP FUNCTION IF EXISTS public.rpc_crm_enfileirar_resposta(text, text, text, text, text);
DROP FUNCTION IF EXISTS public.rpc_crm_enfileirar_resposta(text, text, text, text, text, text);
DROP FUNCTION IF EXISTS public.rpc_crm_enfileirar_resposta(text, text, text, text, text, text, jsonb);

create or replace function public.rpc_crm_enfileirar_resposta(
  p_operation text,
  p_telefone_norm text,
  p_message_text text,
  p_operador text default null,
  p_external_id text default null,
  p_origem text default 'CRM_SITE',
  p_raw_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_id uuid;
  v_external_id text;
  v_destino_tipo text;
  v_lead_telefone text;
begin
  if coalesce(trim(p_operation), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'operation vazio');
  end if;
  if coalesce(trim(p_telefone_norm), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'telefone_norm vazio');
  end if;
  if coalesce(trim(p_message_text), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'message_text vazio');
  end if;

  v_external_id := nullif(trim(coalesce(p_external_id, '')), '');
  if v_external_id is null then
    v_external_id := encode(digest(coalesce(p_operation,'') || '|' || coalesce(p_telefone_norm,'') || '|' || coalesce(p_message_text,'') || '|' || coalesce(p_operador,'') || '|' || to_char(now(),'YYYYMMDDHH24MISSMS'), 'sha256'), 'hex');
  end if;

  v_destino_tipo := coalesce(nullif(p_raw_payload->>'destino_tipo',''), 'LEAD');
  v_lead_telefone := coalesce(nullif(p_raw_payload->>'lead_telefone_norm',''), p_telefone_norm);

  insert into public.crm_outbox (
    operation, telefone_norm, telefone_display, message_text, operador,
    status, status_envio, origem, source, destino_tipo, lead_telefone_norm,
    operador_destino_nome, operador_destino_funcao,
    external_id, attempts, raw_payload
  ) values (
    p_operation, p_telefone_norm, p_telefone_norm, p_message_text, p_operador,
    'PENDENTE', 'PENDENTE', coalesce(nullif(trim(p_origem),''),'CRM_SITE'), coalesce(nullif(trim(p_origem),''),'CRM_SITE'), v_destino_tipo, v_lead_telefone,
    p_raw_payload->>'operador_destino_nome', p_raw_payload->>'operador_destino_funcao',
    v_external_id, 0, coalesce(p_raw_payload,'{}'::jsonb)
  )
  on conflict (external_id) do update set updated_at = now()
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id, 'external_id', v_external_id, 'status', 'PENDENTE', 'destino_tipo', v_destino_tipo);
end;
$$;

notify pgrst, 'reload schema';

-- 6) Seed mínimo caso a tabela esteja vazia por operação
insert into public.crm_respostas_rapidas(operation, titulo, texto, tipo_acao, ordem)
select 'NOVOS_TALENTOS','Saudação','Olá, {primeiro_nome}. Tudo bem? Estou passando para dar continuidade ao seu atendimento.','MENSAGEM_LEAD',10
where not exists (select 1 from public.crm_respostas_rapidas where operation='NOVOS_TALENTOS');
insert into public.crm_respostas_rapidas(operation, titulo, texto, tipo_acao, ordem)
select 'CORRETORES_CRECI','Saudação','Olá, {primeiro_nome}. Tudo bem? Estou passando para dar continuidade ao seu atendimento.','MENSAGEM_LEAD',10
where not exists (select 1 from public.crm_respostas_rapidas where operation='CORRETORES_CRECI');

select 'OK_V15_RESPOSTAS_RAPIDAS_DIRECIONAMENTO' as status;
