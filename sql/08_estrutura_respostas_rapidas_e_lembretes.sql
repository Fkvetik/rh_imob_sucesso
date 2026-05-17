-- RH IMOB CRM V11 — estrutura opcional para respostas rápidas e controle de lembretes.

create table if not exists public.crm_respostas_rapidas (
  id uuid primary key default gen_random_uuid(),
  operation text not null,
  titulo text not null,
  texto text not null,
  ativo boolean not null default true,
  ordem integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(operation, titulo)
);

create table if not exists public.crm_agenda_lembretes_log (
  id uuid primary key default gen_random_uuid(),
  operation text not null,
  telefone_norm text not null,
  agendamento_id uuid,
  tipo text not null,
  status text not null default 'REGISTRADO',
  enviado_em timestamptz,
  created_at timestamptz not null default now(),
  detalhe text,
  raw_payload jsonb,
  unique(operation, telefone_norm, agendamento_id, tipo)
);

create index if not exists idx_crm_agenda_lembretes_log_main
  on public.crm_agenda_lembretes_log(operation, telefone_norm, tipo, status);

insert into public.crm_respostas_rapidas(operation, titulo, texto, ordem)
values
('NOVOS_TALENTOS','Saudação','Olá, tudo bem? Estou passando para dar continuidade ao seu atendimento.',10),
('NOVOS_TALENTOS','Confirmar interesse','Perfeito. Para eu te orientar melhor, você consegue me confirmar se ainda tem interesse em seguir com essa oportunidade?',20),
('NOVOS_TALENTOS','Agendamento','Consigo te passar as opções de horário para alinharmos uma conversa rápida e entender seu momento.',30),
('CORRETORES_CRECI','Saudação','Olá, tudo bem? Estou passando para dar continuidade ao seu atendimento.',10),
('CORRETORES_CRECI','Confirmar interesse','Perfeito. Para eu te orientar melhor, você consegue me confirmar se ainda tem interesse em conhecer as frentes disponíveis?',20),
('CORRETORES_CRECI','Agendamento','Consigo te passar as opções de horário para alinharmos uma conversa rápida e entender seu momento.',30)
on conflict(operation, titulo) do update set texto = excluded.texto, ordem = excluded.ordem, updated_at = now();
