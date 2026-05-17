-- ================================================================
-- RH IMOB CRM V21 — Patch: crm_operacoes
-- Tabela mestre de operações. Permite adicionar novas frentes
-- (ex: PARCEIROS, FRANQUIAS, etc.) sem alterar código.
-- Execute no SQL Editor do Supabase.
-- ================================================================

create table if not exists public.crm_operacoes (
  id            uuid primary key default gen_random_uuid(),
  operation_key text not null unique,   -- ex: 'NOVOS_TALENTOS'
  label         text not null,          -- ex: 'Novos Talentos'
  label_short   text not null,          -- ex: 'NT'
  cor           text,                   -- hex opcional para UI (ex: '#4f46e5')
  ativo         boolean not null default true,
  ordem         int     not null default 10,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Seed: operações originais
insert into public.crm_operacoes (operation_key, label, label_short, cor, ordem)
values
  ('NOVOS_TALENTOS',   'Novos Talentos',   'NT',    '#4f46e5', 10),
  ('CORRETORES_CRECI', 'Corretores CRECI', 'CRECI', '#0284c7', 20)
on conflict (operation_key) do update
  set label       = excluded.label,
      label_short = excluded.label_short,
      cor         = excluded.cor,
      updated_at  = now();

-- Row Level Security
alter table public.crm_operacoes enable row level security;

drop policy if exists "service_role_all_crm_operacoes" on public.crm_operacoes;
create policy "service_role_all_crm_operacoes"
  on public.crm_operacoes
  for all
  to service_role
  using (true)
  with check (true);

notify pgrst, 'reload schema';

-- Para adicionar uma nova operação no futuro:
-- insert into public.crm_operacoes (operation_key, label, label_short, cor, ordem)
-- values ('PARCEIROS', 'Parceiros', 'PAR', '#16a34a', 30);

select operation_key, label, label_short, ativo from public.crm_operacoes order by ordem;
