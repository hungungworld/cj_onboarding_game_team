-- 팀 대항 방탈출: Supabase 테이블·보안·함수
-- 새 Supabase 프로젝트로 옮길 때 SQL Editor에 이 파일을 그대로 붙여 넣어 실행하면 된다.
-- 원칙: 브라우저(anon)는 읽기만 하고, 쓰기는 아래 함수(rpc)로만 한다.

create extension if not exists pgcrypto with schema extensions;

/* ───────── 테이블 ───────── */
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                      -- 참가자 입장 코드 (숫자 4자리)
  title text not null default '',
  host_key text not null,                         -- 진행자 비밀 키 (브라우저에서 못 읽음)
  status text not null default 'open' check (status in ('open', 'ended')),
  created_at timestamptz not null default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 20),
  state jsonb not null default '{}'::jsonb,       -- 조가 함께 쓰는 진행 상황
  ver integer not null default 0,                 -- 바뀔 때마다 +1 (오래된 소식 무시용)
  created_at timestamptz not null default now(),
  unique (session_id, name)
);

create table if not exists public.players (
  id uuid primary key,                            -- 브라우저가 만든 아이디
  session_id uuid not null references public.sessions(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 20),
  secret text,                                    -- 그 기기만 아는 비밀값 (쓰기 확인용, 브라우저에서 못 읽음)
  joined_at timestamptz not null default now()
);

create table if not exists public.messages (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.sessions(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,  -- 보낸 조 (공지는 비어 있음)
  scope text not null check (scope in ('team', 'all', 'notice', 'letter')),
  author text not null default '',
  body text not null check (char_length(body) between 1 and 300),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists teams_session_idx on public.teams(session_id);
create index if not exists players_team_idx on public.players(team_id);
create index if not exists messages_session_idx on public.messages(session_id, id);

/* ───────── 읽기 권한: host_key는 숨김 ───────── */
alter table public.sessions enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.messages enable row level security;

revoke all on public.sessions, public.teams, public.players, public.messages from anon, authenticated;
grant select (id, code, title, status, created_at) on public.sessions to anon, authenticated;
grant select (id, session_id, team_id, name, joined_at) on public.players to anon, authenticated;
grant select on public.teams, public.messages to anon, authenticated;

drop policy if exists "read sessions" on public.sessions;
drop policy if exists "read teams" on public.teams;
drop policy if exists "read players" on public.players;
drop policy if exists "read messages" on public.messages;
create policy "read sessions" on public.sessions for select to anon, authenticated using (true);
create policy "read teams" on public.teams for select to anon, authenticated using (true);
create policy "read players" on public.players for select to anon, authenticated using (true);
create policy "read messages" on public.messages for select to anon, authenticated using (true);

/* ───────── 실시간 방송 대상 ───────── */
do $$ begin
  alter publication supabase_realtime add table public.teams, public.players, public.messages;
exception when duplicate_object then null; end $$;

/* ───────── 내부 도우미: 중간 칸이 없어도 만들어 가며 값 넣기 ───────── */
create or replace function public._jset(doc jsonb, path text[], val jsonb)
returns jsonb language plpgsql immutable set search_path = public as $$
declare i int;
begin
  if doc is null or jsonb_typeof(doc) <> 'object' then doc := '{}'::jsonb; end if;
  for i in 1 .. coalesce(array_length(path, 1), 0) - 1 loop
    if jsonb_typeof(doc #> path[1:i]) is distinct from 'object' then
      doc := jsonb_set(doc, path[1:i], '{}'::jsonb, true);
    end if;
  end loop;
  return jsonb_set(doc, path, val, true);
end $$;

/* ───────── 진행자: 회차 만들기 ───────── */
create or replace function public.create_session(p_title text)
returns json language plpgsql security definer set search_path = public as $$
declare c text; k text; sid uuid;
begin
  loop
    c := lpad((floor(random() * 10000))::int::text, 4, '0');
    exit when not exists (select 1 from sessions where code = c and status = 'open');
  end loop;
  -- 끝난 회차와 코드가 겹치면 옛 회차 코드를 비켜 준다
  update sessions set code = code || '-' || left(id::text, 4) where code = c;
  k := encode(extensions.gen_random_bytes(12), 'hex');
  insert into sessions(code, title, host_key) values (c, left(coalesce(p_title, ''), 40), k) returning id into sid;
  return json_build_object('id', sid, 'code', c, 'host_key', k);
end $$;

create or replace function public.host_check(p_session uuid, p_key text)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from sessions where id = p_session and host_key = p_key);
$$;

create or replace function public.host_post(p_session uuid, p_key text, p_body text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not host_check(p_session, p_key) then raise exception '진행자 키가 맞지 않아요'; end if;
  insert into messages(session_id, scope, author, body) values (p_session, 'notice', '진행자', left(p_body, 300));
end $$;

create or replace function public.host_end(p_session uuid, p_key text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not host_check(p_session, p_key) then raise exception '진행자 키가 맞지 않아요'; end if;
  update sessions set status = 'ended' where id = p_session;
end $$;

/* ───────── 참가자 확인: 아이디 + 그 기기의 비밀값 ───────── */
create or replace function public._player_ok(p_player uuid, p_secret text)
returns players language sql security definer set search_path = public as $$
  select * from players where id = p_player and secret = p_secret;
$$;

/* ───────── 참가자: 입장 ───────── */
create or replace function public.join_session(p_code text, p_team text, p_player uuid, p_secret text, p_name text)
returns json language plpgsql security definer set search_path = public as $$
declare s sessions%rowtype; t teams%rowtype; nteams int; old players%rowtype;
begin
  if p_secret is null or length(p_secret) < 16 then raise exception '잘못된 요청이에요'; end if;
  select * into s from sessions where code = trim(p_code) and status = 'open';
  if not found then raise exception '입장 코드를 찾을 수 없어요'; end if;
  p_team := left(trim(p_team), 20); p_name := left(trim(p_name), 20);
  if p_team = '' or p_name = '' then raise exception '조 이름과 내 이름을 입력하세요'; end if;
  select * into old from players where id = p_player;
  if found and old.secret is distinct from p_secret then raise exception '잘못된 요청이에요'; end if;

  select * into t from teams where session_id = s.id and name = p_team;
  if not found then
    select count(*) into nteams from teams where session_id = s.id;
    if nteams >= 30 then raise exception '조가 너무 많아요'; end if;
    insert into teams(session_id, name) values (s.id, p_team) on conflict (session_id, name) do nothing;
    select * into t from teams where session_id = s.id and name = p_team;
  end if;

  insert into players(id, session_id, team_id, name, secret) values (p_player, s.id, t.id, p_name, p_secret)
    on conflict (id) do update set session_id = excluded.session_id, team_id = excluded.team_id, name = excluded.name,
      joined_at = case when players.team_id = excluded.team_id then players.joined_at else now() end;

  return json_build_object(
    'session', json_build_object('id', s.id, 'code', s.code, 'title', s.title),
    'team', json_build_object('id', t.id, 'name', t.name, 'state', t.state, 'ver', t.ver));
end $$;

/* ───────── 조 진행 상황 바꾸기 ─────────
 * ops: [{ "op": "set", "p": ["solved","room1"], "v": true },
 *       { "op": "inc", "p": ["penalty"], "v": 60 },
 *       { "op": "add", "p": ["items"], "v": {"id": "onlyone", ...} },   -- id가 없을 때만 추가
 *       { "op": "init", "p": ["start"], "v": 1730000000000 }]           -- 비어 있을 때만 */
create or replace function public.team_apply(p_team uuid, p_player uuid, p_secret text, p_ops jsonb)
returns json language plpgsql security definer set search_path = public as $$
declare st jsonb; v int; o jsonb; path text[]; cur jsonb; pl players%rowtype;
begin
  pl := _player_ok(p_player, p_secret);
  if pl.id is null or pl.team_id <> p_team then raise exception '이 조의 조원이 아니에요'; end if;
  if jsonb_array_length(p_ops) > 50 then raise exception '한 번에 너무 많이 바꿨어요'; end if;
  select state into st from teams where id = p_team for update;
  for o in select * from jsonb_array_elements(p_ops) loop
    path := array(select jsonb_array_elements_text(o->'p'));
    cur := st #> path;
    case o->>'op'
      when 'set' then st := _jset(st, path, o->'v');
      when 'inc' then st := _jset(st, path, to_jsonb(coalesce((cur)::text::numeric, 0) + (o->>'v')::numeric));
      when 'init' then if cur is null or cur = 'null'::jsonb then st := _jset(st, path, o->'v'); end if;
      when 'add' then
        if cur is null or jsonb_typeof(cur) <> 'array' then cur := '[]'::jsonb; end if;
        if not exists (select 1 from jsonb_array_elements(cur) e where e->>'id' = o->'v'->>'id') then
          st := _jset(st, path, cur || jsonb_build_array(o->'v'));
        end if;
      else raise exception 'unknown op %', o->>'op';
    end case;
  end loop;
  if pg_column_size(st) > 200000 then raise exception '상태가 너무 커요'; end if;
  update teams set state = st, ver = ver + 1 where id = p_team returning ver into v;
  return json_build_object('state', st, 'ver', v);
end $$;

/* ───────── 메시지 보내기 (조 채팅·전체 채팅·100주년 편지) ─────────
 * 보낸 사람 이름·조·아이디는 서버가 붙인다 (흉내 내기 방지) */
create or replace function public.post_message(p_player uuid, p_secret text, p_scope text, p_body text, p_meta jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare pl players%rowtype; tname text;
begin
  if p_scope not in ('team', 'all', 'letter') then raise exception '보낼 수 없는 종류예요'; end if;
  pl := _player_ok(p_player, p_secret);
  if pl.id is null then raise exception '먼저 입장하세요'; end if;
  select name into tname from teams where id = pl.team_id;
  p_body := left(trim(p_body), 300);
  if p_body = '' then return; end if;
  insert into messages(session_id, team_id, scope, author, body, meta)
    values (pl.session_id, pl.team_id, p_scope, pl.name, p_body,
            (coalesce(p_meta, '{}'::jsonb) - 'team' - 'pid') || jsonb_build_object('team', tname, 'pid', pl.id));
end $$;

revoke all on function public._jset(jsonb, text[], jsonb) from public, anon, authenticated;
revoke all on function public.host_check(uuid, text) from public, anon, authenticated;
revoke all on function public._player_ok(uuid, text) from public, anon, authenticated;
grant execute on function public.create_session(text), public.host_post(uuid, text, text), public.host_end(uuid, text),
  public.join_session(text, text, uuid, text, text), public.team_apply(uuid, uuid, text, jsonb),
  public.post_message(uuid, text, text, text, jsonb) to anon, authenticated;
