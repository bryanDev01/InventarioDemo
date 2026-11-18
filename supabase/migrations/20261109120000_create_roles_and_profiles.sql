create table public.roles (
  name text primary key,
  label text not null,
  created_at timestamptz not null default now()
);

insert into public.roles (name, label) values
  ('admin', 'Administrador'),
  ('invoicer', 'Facturador'),
  ('seller', 'Vendedor');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  username text not null unique,
  role text not null references public.roles (name),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9._-]+$')
);

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and p.is_active
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

alter table public.roles enable row level security;
alter table public.profiles enable row level security;

create policy roles_select_authenticated
  on public.roles
  for select
  to authenticated
  using (true);

create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy profiles_select_admin
  on public.profiles
  for select
  to authenticated
  using ((select public.is_admin()));
