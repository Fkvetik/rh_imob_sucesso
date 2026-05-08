-- RH IMOB • Site público • Vagas dinâmicas
-- Rode no Supabase usado pelo site público/Novos Talentos.
-- Não use service_role no site. Esta tabela libera apenas SELECT público de vagas ATIVAS.

create table if not exists public.site_vagas_publicas (
  vaga_id text primary key,
  titulo text not null,
  categoria text not null default 'Vagas',
  localidade text,
  cidade text,
  estado_uf text,
  modalidade text,
  remuneracao text,
  horario text,
  resumo text,
  destaques text,
  detalhes text,
  requisitos text,
  atividades text,
  selo text,
  prioridade integer default 100,
  status text default 'ATIVA',
  whatsapp_destino text default 'MARIANA',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace function public.site_vagas_publicas_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_site_vagas_publicas_touch on public.site_vagas_publicas;
create trigger trg_site_vagas_publicas_touch
before update on public.site_vagas_publicas
for each row execute function public.site_vagas_publicas_touch_updated_at();

alter table public.site_vagas_publicas enable row level security;

drop policy if exists site_vagas_publicas_select_ativas on public.site_vagas_publicas;
create policy site_vagas_publicas_select_ativas
on public.site_vagas_publicas
for select
to anon, authenticated
using (status = 'ATIVA');

create index if not exists idx_site_vagas_publicas_status_prioridade
on public.site_vagas_publicas(status, prioridade, updated_at desc);
