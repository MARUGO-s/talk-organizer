create policy talk_summaries_update on public.talk_organizer_summaries
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create function public.talk_organizer_update_summary(p_id uuid, p_original text, p_content text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or p_content is null or btrim(p_content) = '' then
    return false;
  end if;
  update public.talk_organizer_summaries
    set content = p_content
    where id = p_id and user_id = auth.uid() and content = p_original;
  return found;
end $$;
revoke all on function public.talk_organizer_update_summary(uuid,text,text) from public, anon;
grant execute on function public.talk_organizer_update_summary(uuid,text,text) to authenticated;
