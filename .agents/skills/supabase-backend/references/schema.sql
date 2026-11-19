-- Nhạc: chạy toàn bộ file này trong Supabase SQL Editor.
-- Chưa chạy thử trên project thật, hãy chạy và kiểm tra lỗi trước khi dựa vào nó.

create table public.mixes (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title            text not null,
  audio_path       text not null,                 -- '<owner_id>/<mix_id>.m4a' trong bucket 'audio'
  mime_type        text not null,
  size_bytes       bigint,
  duration_seconds numeric(10,3) not null check (duration_seconds > 0),
  cover_path       text,
  created_at       timestamptz not null default now()
);

create table public.tracks (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  mix_id        uuid not null references public.mixes(id) on delete cascade,
  position      int not null check (position >= 0),
  name          text not null,
  artist        text not null default '',
  start_seconds numeric(10,3) not null check (start_seconds >= 0),
  unique (mix_id, position),
  unique (mix_id, start_seconds)
);
create index tracks_mix_start_idx on public.tracks (mix_id, start_seconds);

-- end_seconds = start của track kế tiếp, hoặc thời lượng mix với track cuối.
create view public.tracks_timed with (security_invoker = true) as
select t.*,
       coalesce(lead(t.start_seconds) over (partition by t.mix_id order by t.start_seconds),
                m.duration_seconds) as end_seconds
from public.tracks t
join public.mixes m on m.id = t.mix_id;

-- Thay toàn bộ tracklist của một mix trong một giao dịch.
-- p_tracks: [{"name": "...", "artist": "...", "start_seconds": 224}, ...]
create or replace function public.replace_tracks(p_mix_id uuid, p_tracks jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.tracks where mix_id = p_mix_id;
  insert into public.tracks (mix_id, position, name, artist, start_seconds)
  select p_mix_id,
         (row_number() over (order by x.start_seconds))::int - 1,
         x.name, coalesce(x.artist, ''), x.start_seconds
  from jsonb_to_recordset(p_tracks) as x(name text, artist text, start_seconds numeric);
end $$;

-- RLS: chỉ chủ sở hữu
alter table public.mixes  enable row level security;
alter table public.tracks enable row level security;

create policy mixes_owner on public.mixes for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy tracks_owner on public.tracks for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Storage: bucket private. 52428800 = 50 MB (giới hạn gói Free); nâng lên nếu dùng gói Pro.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('audio', 'audio', false, 52428800,
        array['audio/mpeg','audio/mp4','audio/x-m4a','audio/aac','audio/wav','audio/flac','image/jpeg','image/png'])
on conflict (id) do nothing;

create policy audio_owner on storage.objects for all to authenticated
  using (bucket_id = 'audio' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'audio' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Grants: không cho anon đụng vào dữ liệu; chỉ user đã đăng nhập (và bị RLS lọc theo owner).
revoke all on public.mixes, public.tracks, public.tracks_timed from anon;
grant select, insert, update, delete on public.mixes, public.tracks to authenticated;
grant select on public.tracks_timed to authenticated;
revoke execute on function public.replace_tracks(uuid, jsonb) from public, anon;
grant execute on function public.replace_tracks(uuid, jsonb) to authenticated;
