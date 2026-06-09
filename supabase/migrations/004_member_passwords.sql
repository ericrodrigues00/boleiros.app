alter table pool_members
add column if not exists member_password_hash text;
