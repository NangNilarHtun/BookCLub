-- Books & Friends v1 seed data
-- Safe to rerun (idempotent for this seeded dataset).
-- Run this after schema.sql in Supabase SQL Editor.

begin;

-- 1) Ensure every auth user has a profile row.
insert into public.profiles (id, display_name)
select
  u.id,
  nullif(split_part(coalesce(u.email, ''), '@', 1), '')
from auth.users u
on conflict (id) do nothing;

-- 2) Explicit display names for known users.
update public.profiles p
set
  display_name = v.display_name,
  updated_at = now()
from (
  values
    ('nilar@gmail.com'::text, 'Nilar'::text),
    ('saline@gmail.com'::text, 'Saline'::text)
) as v(email, display_name)
join auth.users u on u.email = v.email
where p.id = u.id;

-- 3) Give fallback display names for any remaining null/blank profiles.
update public.profiles p
set
  display_name = initcap(split_part(coalesce(u.email, 'member'), '@', 1)),
  updated_at = now()
from auth.users u
where p.id = u.id
  and (p.display_name is null or btrim(p.display_name) = '');

-- 4) Build two demo public sessions (if hosts exist).
with nilar as (
  select id as user_id from auth.users where email = 'nilar@gmail.com' limit 1
),
saline as (
  select id as user_id from auth.users where email = 'saline@gmail.com' limit 1
)
insert into public.reading_sessions (
  host_user_id,
  book_title,
  book_author,
  total_chapters,
  visibility
)
select n.user_id, 'Atomic Habits', 'James Clear', 20, 'public'
from nilar n
where not exists (
  select 1 from public.reading_sessions rs
  where rs.host_user_id = n.user_id
    and rs.book_title = 'Atomic Habits'
    and rs.book_author = 'James Clear'
)
union all
select s.user_id, 'The Alchemist', 'Paulo Coelho', 14, 'public'
from saline s
where not exists (
  select 1 from public.reading_sessions rs
  where rs.host_user_id = s.user_id
    and rs.book_title = 'The Alchemist'
    and rs.book_author = 'Paulo Coelho'
);

-- 5) Ensure all users are members of seeded sessions.
insert into public.session_members (session_id, user_id)
select rs.id, u.id
from public.reading_sessions rs
cross join auth.users u
where (rs.book_title, rs.book_author) in (
  ('Atomic Habits', 'James Clear'),
  ('The Alchemist', 'Paulo Coelho')
)
on conflict (session_id, user_id) do nothing;

-- 6) Replace seeded progress updates to keep output clean on reruns.
delete from public.progress_updates pu
using public.reading_sessions rs
where pu.session_id = rs.id
  and (rs.book_title, rs.book_author) in (
    ('Atomic Habits', 'James Clear'),
    ('The Alchemist', 'Paulo Coelho')
  );

insert into public.progress_updates (session_id, user_id, current_chapter, created_at)
select
  rs.id,
  sm.user_id,
  case
    when rs.book_title = 'Atomic Habits' then least(20, 2 + row_number() over (partition by rs.id order by sm.user_id) * 3)
    else least(14, 1 + row_number() over (partition by rs.id order by sm.user_id) * 2)
  end as current_chapter,
  now() - interval '1 day' + (row_number() over (partition by rs.id order by sm.user_id) * interval '30 minutes')
from public.reading_sessions rs
join public.session_members sm on sm.session_id = rs.id
where (rs.book_title, rs.book_author) in (
  ('Atomic Habits', 'James Clear'),
  ('The Alchemist', 'Paulo Coelho')
);

-- 7) Replace seeded comments for deterministic feed.
delete from public.discussion_comments dc
using public.reading_sessions rs
where dc.session_id = rs.id
  and dc.content like '[seed] %'
  and (rs.book_title, rs.book_author) in (
    ('Atomic Habits', 'James Clear'),
    ('The Alchemist', 'Paulo Coelho')
  );

insert into public.discussion_comments (session_id, user_id, content, created_at)
select
  rs.id,
  sm.user_id,
  '[seed] Loving this chapter pacing so far.',
  now() - interval '10 hours'
from public.reading_sessions rs
join public.session_members sm on sm.session_id = rs.id
where (rs.book_title, rs.book_author) in (
  ('Atomic Habits', 'James Clear'),
  ('The Alchemist', 'Paulo Coelho')
)
and sm.user_id = rs.host_user_id
union all
select
  rs.id,
  sm.user_id,
  '[seed] The key takeaway for me is consistency.',
  now() - interval '8 hours'
from public.reading_sessions rs
join public.session_members sm on sm.session_id = rs.id
where (rs.book_title, rs.book_author) in (
  ('Atomic Habits', 'James Clear'),
  ('The Alchemist', 'Paulo Coelho')
)
and sm.user_id <> rs.host_user_id;

-- 8) Replace reactions for seeded comments.
delete from public.comment_reactions cr
using public.discussion_comments dc
where cr.comment_id = dc.id
  and dc.content like '[seed] %';

insert into public.comment_reactions (comment_id, user_id, emoji)
select dc.id, sm.user_id, '👍'
from public.discussion_comments dc
join public.session_members sm on sm.session_id = dc.session_id
where dc.content like '[seed] %'
union all
select dc.id, sm.user_id, '📚'
from public.discussion_comments dc
join public.session_members sm on sm.session_id = dc.session_id
where dc.content like '[seed] %'
  and sm.user_id <> dc.user_id;

commit;

