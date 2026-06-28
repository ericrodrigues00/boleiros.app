alter table matches drop constraint if exists matches_stage_check;

alter table matches add constraint matches_stage_check
  check (stage in ('group', 'round_32', 'round_16', 'quarter', 'semi', 'third_place', 'final'));
