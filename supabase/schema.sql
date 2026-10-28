create table public.talk_organizer_files (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 file_name text not null check(length(file_name) between 1 and 255), content text not null check(length(content) <= 1500000), created_at timestamptz not null default now()
);
create table public.talk_organizer_summaries (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 title text not null check(length(title) between 1 and 255), question text not null, content text not null, sources jsonb not null default '[]'::jsonb, created_at timestamptz not null default now()
);
alter table public.talk_organizer_files enable row level security;
alter table public.talk_organizer_summaries enable row level security;
create policy talk_files_select on public.talk_organizer_files for select to authenticated using ((select auth.uid()) = user_id);
create policy talk_files_insert on public.talk_organizer_files for insert to authenticated with check ((select auth.uid()) = user_id);
create policy talk_files_delete on public.talk_organizer_files for delete to authenticated using ((select auth.uid()) = user_id);
create policy talk_summaries_select on public.talk_organizer_summaries for select to authenticated using ((select auth.uid()) = user_id);
create policy talk_summaries_insert on public.talk_organizer_summaries for insert to authenticated with check ((select auth.uid()) = user_id);
create policy talk_summaries_delete on public.talk_organizer_summaries for delete to authenticated using ((select auth.uid()) = user_id);
grant select,insert,delete on public.talk_organizer_files, public.talk_organizer_summaries to authenticated;
create function public.talk_organizer_store_secret(p_user uuid, p_secret text) returns void language plpgsql security definer set search_path = '' as $$
declare sid uuid; n text := 'talk_organizer_openai_' || p_user::text;
begin
 if p_user is null or p_secret is null or length(p_secret) < 8 or length(p_secret) > 512 then raise exception 'invalid secret'; end if;
 select id into sid from vault.secrets where name=n;
 if sid is null then perform vault.create_secret(p_secret,n,'Talk organizer OpenAI API key'); else perform vault.update_secret(sid,p_secret,n,'Talk organizer OpenAI API key'); end if;
end $$;
create function public.talk_organizer_read_secret(p_user uuid) returns text language sql security definer set search_path = '' as $$ select decrypted_secret from vault.decrypted_secrets where name = 'talk_organizer_openai_' || p_user::text limit 1 $$;
revoke all on function public.talk_organizer_store_secret(uuid,text), public.talk_organizer_read_secret(uuid) from public, anon, authenticated;
grant execute on function public.talk_organizer_store_secret(uuid,text), public.talk_organizer_read_secret(uuid) to service_role;
