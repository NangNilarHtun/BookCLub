-- Books & Friends v1 schema (public sessions only)

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reading_sessions (
  id uuid primary key default gen_random_uuid(),
  host_user_id uuid not null references auth.users(id) on delete cascade,
  book_title text not null,
  book_author text not null,
  total_chapters int not null check (total_chapters > 0),
  visibility text not null default 'public' check (visibility = 'public'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.session_members (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.reading_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique(session_id, user_id)
);

create table if not exists public.progress_updates (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.reading_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  current_chapter int not null check (current_chapter >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.discussion_comments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.reading_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comment_reactions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.discussion_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique(comment_id, user_id, emoji)
);

alter table public.profiles enable row level security;
alter table public.reading_sessions enable row level security;
alter table public.session_members enable row level security;
alter table public.progress_updates enable row level security;
alter table public.discussion_comments enable row level security;
alter table public.comment_reactions enable row level security;

drop policy if exists "read profiles" on public.profiles;
create policy "read profiles" on public.profiles
for select using (true);

drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles
for insert to authenticated
with check (auth.uid() = id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "read sessions" on public.reading_sessions;
create policy "read sessions" on public.reading_sessions
for select using (true);

drop policy if exists "authenticated can create sessions" on public.reading_sessions;
create policy "authenticated can create sessions" on public.reading_sessions
for insert to authenticated
with check (auth.uid() = host_user_id and visibility = 'public');

drop policy if exists "host can update own session" on public.reading_sessions;
create policy "host can update own session" on public.reading_sessions
for update to authenticated
using (auth.uid() = host_user_id)
with check (auth.uid() = host_user_id and visibility = 'public');

drop policy if exists "read session members" on public.session_members;
create policy "read session members" on public.session_members
for select using (true);

drop policy if exists "join session as self" on public.session_members;
create policy "join session as self" on public.session_members
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "read progress" on public.progress_updates;
create policy "read progress" on public.progress_updates
for select using (true);

drop policy if exists "add own progress if member" on public.progress_updates;
create policy "add own progress if member" on public.progress_updates
for insert to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.session_members sm
    where sm.session_id = progress_updates.session_id
      and sm.user_id = auth.uid()
  )
);

drop policy if exists "read comments" on public.discussion_comments;
create policy "read comments" on public.discussion_comments
for select using (true);

drop policy if exists "add own comments if member" on public.discussion_comments;
create policy "add own comments if member" on public.discussion_comments
for insert to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.session_members sm
    where sm.session_id = discussion_comments.session_id
      and sm.user_id = auth.uid()
  )
);

drop policy if exists "read reactions" on public.comment_reactions;
create policy "read reactions" on public.comment_reactions
for select using (true);

drop policy if exists "add own reactions if session member" on public.comment_reactions;
create policy "add own reactions if session member" on public.comment_reactions
for insert to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.discussion_comments dc
    join public.session_members sm on sm.session_id = dc.session_id
    where dc.id = comment_reactions.comment_id
      and sm.user_id = auth.uid()
  )
);

drop policy if exists "delete own reactions" on public.comment_reactions;
create policy "delete own reactions" on public.comment_reactions
for delete to authenticated
using (auth.uid() = user_id);

