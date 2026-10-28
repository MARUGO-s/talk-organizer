create function public.talk_organizer_shared_user_id() returns uuid
language sql security definer set search_path = '' as $$
  select id from auth.users where email = 'talk-organizer-marugo@example.com'
    and raw_app_meta_data->>'talk_organizer_shared' = 'true' limit 1
$$;

create function public.talk_organizer_can_setup_shared(p_owner uuid) returns boolean
language sql security definer set search_path = '' as $$
  select p_owner is not null
    and ((exists(select 1 from public.talk_organizer_files where user_id = p_owner))
      or (exists(select 1 from public.talk_organizer_summaries where user_id = p_owner)))
    and not exists(select 1 from public.talk_organizer_files where user_id <> p_owner)
    and not exists(select 1 from public.talk_organizer_summaries where user_id <> p_owner)
    and p_owner is distinct from public.talk_organizer_shared_user_id()
$$;

create function public.talk_organizer_share_existing(p_owner uuid, p_shared uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare old_key text; new_key_id uuid;
begin
  if p_owner is null or p_shared is null or p_owner = p_shared then raise exception 'invalid users'; end if;
  if p_shared is distinct from public.talk_organizer_shared_user_id() then raise exception 'invalid shared account'; end if;
  if not exists (select 1 from public.talk_organizer_files where user_id = p_owner)
     and not exists (select 1 from public.talk_organizer_summaries where user_id = p_owner) then
    raise exception 'owner has no existing records';
  end if;
  if exists (select 1 from public.talk_organizer_files where user_id not in (p_owner,p_shared))
     or exists (select 1 from public.talk_organizer_summaries where user_id not in (p_owner,p_shared)) then
    raise exception 'other owners exist';
  end if;
  select decrypted_secret into old_key from vault.decrypted_secrets where name = 'talk_organizer_openai_' || p_owner::text limit 1;
  if old_key is not null then
    select id into new_key_id from vault.secrets where name = 'talk_organizer_openai_' || p_shared::text;
    if new_key_id is null then
      perform vault.create_secret(old_key, 'talk_organizer_openai_' || p_shared::text, 'Talk organizer shared OpenAI API key');
    end if;
  end if;
  update public.talk_organizer_files set user_id = p_shared where user_id = p_owner;
  update public.talk_organizer_summaries set user_id = p_shared where user_id = p_owner;
end $$;
revoke all on function public.talk_organizer_shared_user_id(), public.talk_organizer_can_setup_shared(uuid), public.talk_organizer_share_existing(uuid,uuid) from public, anon, authenticated;
grant execute on function public.talk_organizer_shared_user_id(), public.talk_organizer_can_setup_shared(uuid), public.talk_organizer_share_existing(uuid,uuid) to service_role;
