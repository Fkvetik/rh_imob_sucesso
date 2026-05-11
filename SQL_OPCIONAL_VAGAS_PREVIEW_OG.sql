-- Opcional: melhora o preview visual específico por vaga.
-- Rode no Supabase somente se a tabela site_vagas_publicas ainda não tiver essas colunas.
-- Não use service_role no front-end. Esta SQL é apenas para estrutura de dados.

alter table public.site_vagas_publicas
  add column if not exists slug text,
  add column if not exists imagem_og text;

create unique index if not exists site_vagas_publicas_slug_uidx
  on public.site_vagas_publicas (slug)
  where slug is not null and slug <> '';

comment on column public.site_vagas_publicas.slug is 'Slug público usado em links como /vaga/corretor-alto-padrao-sao-paulo.';
comment on column public.site_vagas_publicas.imagem_og is 'Imagem 1200x630 usada no preview do WhatsApp/ redes sociais para a vaga.';
