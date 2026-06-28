alter table matches
  add column if not exists unlocked_override boolean not null default false;
