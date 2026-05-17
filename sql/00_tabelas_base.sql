-- ================================================================
-- RH IMOB CRM -- Tabelas base completas
-- Execute no SQL Editor do Supabase (supabase.com/dashboard/project/hrsqxyisqinjuieigzvc/sql/new)
-- Seguro para re-executar: usa CREATE TABLE IF NOT EXISTS
-- ================================================================

-- ── crm_leads ───────────────────────────────────────────────────
create table if not exists public.crm_leads (
  id                  uuid        primary key default gen_random_uuid(),
  operation           text        not null,
  lead_id             text,
  telefone_norm       text        not null,
  telefone_display    text,
  nome                text,
  origem              text,
  campanha            text,
  status_atendimento  text        not null default 'NOVO',
  bucket              text        not null default 'NOVO',
  fase_funil          text,
  humano              boolean     not null default false,
  agenda_status       text,
  operador            text,
  cidade              text,
  bairro              text,
  profissao           text,
  idade               text,
  ultima_mensagem     text,
  ultima_direcao      text,
  ultima_atividade_em timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique(operation, telefone_norm)
);

create index if not exists idx_crm_leads_op_ativ
  on public.crm_leads(operation, ultima_atividade_em desc nulls last);
create index if not exists idx_crm_leads_op_status
  on public.crm_leads(operation, status_atendimento);
create index if not exists idx_crm_leads_op_bucket
  on public.crm_leads(operation, bucket);

alter table public.crm_leads enable row level security;
drop policy if exists "service_role_all_crm_leads" on public.crm_leads;
create policy "service_role_all_crm_leads"
  on public.crm_leads for all to service_role using (true) with check (true);

-- ── crm_mensagens ────────────────────────────────────────────────
create table if not exists public.crm_mensagens (
  id           uuid        primary key default gen_random_uuid(),
  operation    text        not null,
  telefone_norm text       not null,
  direction    text        not null default 'IN',  -- IN | OUT
  message_text text,
  message_type text        not null default 'TEXT',
  source       text,       -- ZAPI | CRM_SITE | APPS_SCRIPT
  message_at   timestamptz not null default now(),
  status_envio text,
  operador     text,
  external_id  text,
  dedup_key    text,       -- chave SHA-256 usada pelo 08 para dedup
  dedup_minuto text,       -- chave de minuto usada pelo 07 para dedup
  raw_payload  jsonb,
  created_at   timestamptz not null default now()
);

-- Constraint de dedup para o 08_Conversa_Dedup (on_conflict=operation,telefone_norm,dedup_key)
create unique index if not exists idx_crm_mensagens_dedup_key
  on public.crm_mensagens(operation, telefone_norm, dedup_key)
  where dedup_key is not null;

create index if not exists idx_crm_mensagens_conv
  on public.crm_mensagens(operation, telefone_norm, message_at asc);
create index if not exists idx_crm_mensagens_ext
  on public.crm_mensagens(external_id) where external_id is not null;

alter table public.crm_mensagens enable row level security;
drop policy if exists "service_role_all_crm_mensagens" on public.crm_mensagens;
create policy "service_role_all_crm_mensagens"
  on public.crm_mensagens for all to service_role using (true) with check (true);

-- ── crm_outbox ───────────────────────────────────────────────────
create table if not exists public.crm_outbox (
  id                    uuid        primary key default gen_random_uuid(),
  operation             text        not null,
  telefone_norm         text        not null,
  telefone_display      text,
  message_text          text        not null,
  operador              text,
  external_id           text        unique,
  status                text        not null default 'PENDENTE',
  status_envio          text        not null default 'PENDENTE',
  origem                text,
  source                text,
  destino_tipo          text        not null default 'LEAD',
  lead_telefone_norm    text,
  operador_destino_nome text,
  operador_destino_funcao text,
  raw_payload           jsonb,
  tentativas            int         not null default 0,
  ultimo_erro           text,
  processado_em         timestamptz,
  created_at            timestamptz not null default now()
);

create index if not exists idx_crm_outbox_pendente
  on public.crm_outbox(operation, status, created_at asc)
  where status = 'PENDENTE';

alter table public.crm_outbox enable row level security;
drop policy if exists "service_role_all_crm_outbox" on public.crm_outbox;
create policy "service_role_all_crm_outbox"
  on public.crm_outbox for all to service_role using (true) with check (true);

-- ── crm_eventos ──────────────────────────────────────────────────
create table if not exists public.crm_eventos (
  id           uuid        primary key default gen_random_uuid(),
  operation    text        not null,
  telefone_norm text       not null,
  lead_id      uuid,
  evento_tipo  text        not null,
  evento_texto text,
  operador     text,
  evento_em    timestamptz not null default now(),
  raw_payload  jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists idx_crm_eventos_lead
  on public.crm_eventos(operation, telefone_norm, evento_em desc);

alter table public.crm_eventos enable row level security;
drop policy if exists "service_role_all_crm_eventos" on public.crm_eventos;
create policy "service_role_all_crm_eventos"
  on public.crm_eventos for all to service_role using (true) with check (true);

-- ── crm_notas ────────────────────────────────────────────────────
create table if not exists public.crm_notas (
  id           uuid        primary key default gen_random_uuid(),
  operation    text        not null,
  telefone_norm text       not null,
  operador     text,
  nota         text        not null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_crm_notas_lead
  on public.crm_notas(operation, telefone_norm, created_at desc);

alter table public.crm_notas enable row level security;
drop policy if exists "service_role_all_crm_notas" on public.crm_notas;
create policy "service_role_all_crm_notas"
  on public.crm_notas for all to service_role using (true) with check (true);

-- ── crm_agendamentos ─────────────────────────────────────────────
create table if not exists public.crm_agendamentos (
  id               uuid        primary key default gen_random_uuid(),
  operation        text        not null,
  lead_id          uuid,
  telefone_norm    text        not null,
  data_agendamento date        not null,
  hora_agendamento time,
  operador         text,
  status           text        not null default 'AGENDADO',
  observacao       text,
  raw_snapshot     jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_crm_agendamentos_lead
  on public.crm_agendamentos(operation, telefone_norm, data_agendamento asc);
create index if not exists idx_crm_agendamentos_data
  on public.crm_agendamentos(data_agendamento, status);

alter table public.crm_agendamentos enable row level security;
drop policy if exists "service_role_all_crm_agendamentos" on public.crm_agendamentos;
create policy "service_role_all_crm_agendamentos"
  on public.crm_agendamentos for all to service_role using (true) with check (true);

-- ── RPC: enfileirar resposta (fallback da rota send-message) ────
create or replace function public.rpc_crm_enfileirar_resposta(
  p_operation          text,
  p_telefone_norm      text,
  p_message_text       text,
  p_operador           text  default 'Operador',
  p_external_id        text  default null,
  p_origem             text  default 'CRM_SITE',
  p_raw_payload        jsonb default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_ext text := coalesce(p_external_id, gen_random_uuid()::text);
  v_row record;
begin
  insert into public.crm_outbox(
    operation, telefone_norm, message_text, operador,
    external_id, status, status_envio, origem, source,
    destino_tipo, lead_telefone_norm, raw_payload
  ) values (
    p_operation, p_telefone_norm, p_message_text, p_operador,
    v_ext, 'PENDENTE', 'PENDENTE', p_origem, p_origem,
    'LEAD', p_telefone_norm, p_raw_payload
  )
  on conflict(external_id) do update
    set status      = 'PENDENTE',
        updated_at  = now()
  returning * into v_row;

  return jsonb_build_object('ok', true, 'external_id', v_ext);
end;
$$;

-- Adiciona coluna updated_at ao outbox se faltar (retrocompatibilidade)
alter table public.crm_outbox
  add column if not exists updated_at timestamptz not null default now();

-- ── Verifica o que foi criado ────────────────────────────────────
select
  table_name,
  (select count(*) from information_schema.columns c
   where c.table_name = t.table_name and c.table_schema = 'public') as colunas
from information_schema.tables t
where table_schema = 'public'
  and table_name in ('crm_leads','crm_mensagens','crm_outbox','crm_eventos',
                     'crm_notas','crm_agendamentos','crm_operacoes',
                     'crm_respostas_rapidas','crm_agenda_lembretes_log')
order by table_name;
