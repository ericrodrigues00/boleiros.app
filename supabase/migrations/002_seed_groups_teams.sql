-- Copa 2026 seed: 12 groups, 48 teams, 72 group stage matches
-- Idempotent: only runs when wc_groups is empty

do $$
begin
  if (select count(*) from wc_groups) > 0 then
    return;
  end if;

  insert into tournament_settings (key, value) values
    ('group_stage_deadline', '{"kickoff": "2026-06-11T19:00:00Z"}'),
    ('top_scorer', '{"player": null}')
  on conflict (key) do nothing;

  insert into wc_groups (name, sort_order) values
    ('A', 1), ('B', 2), ('C', 3), ('D', 4),
    ('E', 5), ('F', 6), ('G', 7), ('H', 8),
    ('I', 9), ('J', 10), ('K', 11), ('L', 12);
end $$;

with g as (select id, name from wc_groups)
insert into teams (name, flag_code, group_id)
select t.name, t.flag_code, g.id
from g
join (values
  ('A', 'México', 'mx'),
  ('A', 'África do Sul', 'za'),
  ('A', 'Coreia do Sul', 'kr'),
  ('A', 'República Tcheca', 'cz'),
  ('B', 'Canadá', 'ca'),
  ('B', 'Bósnia e Herzegovina', 'ba'),
  ('B', 'Catar', 'qa'),
  ('B', 'Suíça', 'ch'),
  ('C', 'Brasil', 'br'),
  ('C', 'Marrocos', 'ma'),
  ('C', 'Haiti', 'ht'),
  ('C', 'Escócia', 'gb-sct'),
  ('D', 'Estados Unidos', 'us'),
  ('D', 'Paraguai', 'py'),
  ('D', 'Austrália', 'au'),
  ('D', 'Turquia', 'tr'),
  ('E', 'Alemanha', 'de'),
  ('E', 'Curaçau', 'cw'),
  ('E', 'Costa do Marfim', 'ci'),
  ('E', 'Equador', 'ec'),
  ('F', 'Holanda', 'nl'),
  ('F', 'Japão', 'jp'),
  ('F', 'Suécia', 'se'),
  ('F', 'Tunísia', 'tn'),
  ('G', 'Bélgica', 'be'),
  ('G', 'Egito', 'eg'),
  ('G', 'Irã', 'ir'),
  ('G', 'Nova Zelândia', 'nz'),
  ('H', 'Espanha', 'es'),
  ('H', 'Cabo Verde', 'cv'),
  ('H', 'Arábia Saudita', 'sa'),
  ('H', 'Uruguai', 'uy'),
  ('I', 'França', 'fr'),
  ('I', 'Senegal', 'sn'),
  ('I', 'Iraque', 'iq'),
  ('I', 'Noruega', 'no'),
  ('J', 'Argentina', 'ar'),
  ('J', 'Argélia', 'dz'),
  ('J', 'Áustria', 'at'),
  ('J', 'Jordânia', 'jo'),
  ('K', 'Portugal', 'pt'),
  ('K', 'Congo', 'cd'),
  ('K', 'Uzbequistão', 'uz'),
  ('K', 'Colômbia', 'co'),
  ('L', 'Inglaterra', 'gb-eng'),
  ('L', 'Croácia', 'hr'),
  ('L', 'Gana', 'gh'),
  ('L', 'Panamá', 'pa')
) as t(grp, name, flag_code) on g.name = t.grp
where (select count(*) from teams) = 0;

do $$
declare
  grp record;
  t1 uuid;
  t2 uuid;
  t3 uuid;
  t4 uuid;
  base_date timestamptz := '2026-06-11T19:00:00Z';
  match_offset integer := 0;
begin
  if (select count(*) from matches where stage = 'group') > 0 then
    return;
  end if;

  for grp in select id, name, sort_order from wc_groups order by sort_order loop
    select id into t1 from teams where group_id = grp.id order by name limit 1 offset 0;
    select id into t2 from teams where group_id = grp.id order by name limit 1 offset 1;
    select id into t3 from teams where group_id = grp.id order by name limit 1 offset 2;
    select id into t4 from teams where group_id = grp.id order by name limit 1 offset 3;

    insert into matches (home_team_id, away_team_id, stage, group_id, kickoff_at) values
      (t1, t2, 'group', grp.id, base_date + (match_offset || ' hours')::interval),
      (t3, t4, 'group', grp.id, base_date + ((match_offset + 3) || ' hours')::interval),
      (t1, t3, 'group', grp.id, base_date + ((match_offset + 48) || ' hours')::interval),
      (t2, t4, 'group', grp.id, base_date + ((match_offset + 51) || ' hours')::interval),
      (t1, t4, 'group', grp.id, base_date + ((match_offset + 96) || ' hours')::interval),
      (t2, t3, 'group', grp.id, base_date + ((match_offset + 99) || ' hours')::interval);

    match_offset := match_offset + 6;
  end loop;
end $$;
