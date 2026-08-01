-- Rode isto no SQL Editor do seu projeto Supabase (Dashboard > SQL Editor > New query)

create table if not exists roleta_estado (
  id text primary key default 'main',
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- RLS habilitado por segurança. O backend acessa com a service_role key,
-- que ignora RLS, então nenhuma policy pública é necessária.
alter table roleta_estado enable row level security;
