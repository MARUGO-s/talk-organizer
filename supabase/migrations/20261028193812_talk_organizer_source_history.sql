alter table public.talk_organizer_summaries add column source_file_ids uuid[];
comment on column public.talk_organizer_summaries.source_file_ids is 'Original talk file IDs; null means provenance is unknown. IDs remain after file deletion.';
