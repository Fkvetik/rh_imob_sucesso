-- ============================================================
-- Tabela de leads de EMPRESA (formulário de contratação)
-- Captura progressiva: grava assim que há nome/telefone, antes do WhatsApp.
-- Rodar no Supabase (projeto pufxvskozfdvfscqnays) → SQL Editor
-- ============================================================

create table if not exists public.site_leads (
  id uuid primary key default gen_random_uuid(),
  session_id text unique,
  nome text,
  whatsapp text,
  empresa text,
  cidade text,
  cargo_vaga text,
  quantidade text,
  urgencia text,
  formato_contratacao text,
  remuneracao text,
  beneficios text,
  exigencias text,
  mensagem text,
  origem text,
  pagina text,
  enviou_whatsapp boolean default false,
  status text default 'novo',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.site_leads enable row level security;

-- anon (chave pública) pode INSERIR e ATUALIZAR (para upsert progressivo),
-- mas NÃO pode LER — os telefones dos leads ficam protegidos.
drop policy if exists site_leads_insert on public.site_leads;
create policy site_leads_insert on public.site_leads
  for insert to anon with check (true);

drop policy if exists site_leads_update on public.site_leads;
create policy site_leads_update on public.site_leads
  for update to anon using (true) with check (true);

grant insert, update on public.site_leads to anon;

-- updated_at automático
create or replace function public.touch_site_leads()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_touch_site_leads on public.site_leads;
create trigger trg_touch_site_leads
  before update on public.site_leads
  for each row execute function public.touch_site_leads();
