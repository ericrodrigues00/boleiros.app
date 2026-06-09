drop view if exists pool_rankings;

create view pool_rankings as
select
  pm.pool_id,
  pm.id as member_id,
  pm.username,
  pm.top_scorer_pick,
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
