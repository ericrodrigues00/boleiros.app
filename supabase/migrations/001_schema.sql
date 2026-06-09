-- boleiros.app schema

create extension if not exists "pgcrypto";

-- Global tournament data
create table wc_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null
);

create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  flag_code text not null,
  group_id uuid not null references wc_groups(id) on delete cascade
);

create table tournament_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table group_results (
  group_id uuid primary key references wc_groups(id) on delete cascade,
  first_team_id uuid references teams(id),
  second_team_id uuid references teams(id),
  third_team_id uuid references teams(id),
  advancing_as_third boolean not null default false,
  confirmed_at timestamptz
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  home_team_id uuid references teams(id),
  away_team_id uuid references teams(id),
  home_label text,
  away_label text,
  stage text not null check (stage in ('group', 'round_16', 'quarter', 'semi', 'third_place', 'final')),
  group_id uuid references wc_groups(id),
  kickoff_at timestamptz not null,
  home_score integer,
  away_score integer,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'finished')),
  locked_override boolean not null default false,
  created_at timestamptz not null default now()
);

-- Pool tables
create table pools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_token text not null unique,
  pool_password_hash text not null,
  created_at timestamptz not null default now()
);

create table pool_members (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references pools(id) on delete cascade,
  username text not null,
  role text not null check (role in ('admin', 'member')),
  top_scorer_pick text not null,
  joined_at timestamptz not null default now(),
  unique (pool_id, username)
);

create table group_bets (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references pool_members(id) on delete cascade,
  group_id uuid not null references wc_groups(id) on delete cascade,
  predicted_first uuid not null references teams(id),
  predicted_second uuid not null references teams(id),
  points_earned integer not null default 0,
  unique (member_id, group_id)
);

create table best_third_bets (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references pool_members(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  points_earned integer not null default 0,
  unique (member_id, team_id)
);

create table match_predictions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references pool_members(id) on delete cascade,
  match_id uuid not null references matches(id) on delete cascade,
  home_score integer not null check (home_score >= 0),
  away_score integer not null check (away_score >= 0),
  points_earned integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, match_id)
);

create index idx_teams_group on teams(group_id);
create index idx_matches_kickoff on matches(kickoff_at);
create index idx_matches_stage on matches(stage);
create index idx_pool_members_pool on pool_members(pool_id);
create index idx_group_bets_member on group_bets(member_id);
create index idx_best_third_member on best_third_bets(member_id);
create index idx_match_predictions_member on match_predictions(member_id);
create index idx_match_predictions_match on match_predictions(match_id);

create or replace view pool_rankings as
select
  pm.pool_id,
  pm.id as member_id,
  pm.username,
  coalesce(gb_pts.total, 0)::integer + coalesce(bt_pts.total, 0)::integer + coalesce(mp_pts.total, 0)::integer as total_points,
  coalesce(gb_pts.total, 0)::integer as group_points,
  coalesce(bt_pts.total, 0)::integer as best_third_points,
  coalesce(mp_pts.total, 0)::integer as match_points,
  coalesce(mp_pts.exact_count, 0)::integer as exact_score_count,
  case
    when ts.value->>'player' is not null
      and lower(pm.top_scorer_pick) = lower(ts.value->>'player')
    then true
    else false
  end as top_scorer_correct
from pool_members pm
left join (
  select member_id, sum(points_earned) as total
  from group_bets
  group by member_id
) gb_pts on gb_pts.member_id = pm.id
left join (
  select member_id, sum(points_earned) as total
  from best_third_bets
  group by member_id
) bt_pts on bt_pts.member_id = pm.id
left join (
  select
    member_id,
    sum(points_earned) as total,
    count(*) filter (
      where points_earned >= 10
    ) as exact_count
  from match_predictions
  group by member_id
) mp_pts on mp_pts.member_id = pm.id
left join tournament_settings ts on ts.key = 'top_scorer';

alter table wc_groups enable row level security;
alter table teams enable row level security;
alter table tournament_settings enable row level security;
alter table group_results enable row level security;
alter table matches enable row level security;
alter table pools enable row level security;
alter table pool_members enable row level security;
alter table group_bets enable row level security;
alter table best_third_bets enable row level security;
alter table match_predictions enable row level security;
