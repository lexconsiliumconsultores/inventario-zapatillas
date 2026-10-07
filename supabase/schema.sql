-- Velvet Store (PROYECTO 1) - schema Supabase
-- Simplicity version: anon key does everything (same as LEX); RLS enabledwith wide policies to keepold JS unchanged.

create table if not exists public.inventario (
  id bigint generated always as identity primary key,
  temporada text,
  codigo text,
  producto text,
  categoria text,
  genero text,
  precio numeric default 0,
  tallas jsonb default '[]'::jsonb,
  foto text,
  created_at timestamptz default now()
);

create table if not exists public.pedidos (
  id bigint generated always as identity primary key,
  fecha timestamptz default now(),
  cliente text,
  telefono text,
  direccion text,
  observacion text,
  lineas jsonb default '[]'::jsonb,
  total numeric default 0,
  estado text default 'pendiente',
  despachado boolean default false
);

delete from public.inventario;
delete from public.pedidos;

alter table public.inventario enable row level security;
alter table public.pedidos enable row level security;

drop policy if exists "allow_all_inventario" on public.inventario;
drop policy if exists "allow_all_pedidos" on public.pedidos;
create policy "allow_all_inventario" on public.inventario for all using (true) with check (true);
create policy "allow_all_pedidos" on public.pedidos for all using (true) with check (true);
