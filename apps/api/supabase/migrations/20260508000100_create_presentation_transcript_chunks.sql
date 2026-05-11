create table if not exists public.presentation_transcript_chunks (
    id uuid primary key default gen_random_uuid(),
    presentation_id uuid not null references public.presentations(id) on delete cascade,
    slide_id uuid not null references public.slides(id) on delete cascade,
    chunk_started_at_ms integer not null,
    chunk_ended_at_ms integer not null,
    transcript text not null default '',
    extra_data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_presentation_transcript_chunks_presentation_id
    on public.presentation_transcript_chunks(presentation_id);

create index if not exists idx_presentation_transcript_chunks_slide_id
    on public.presentation_transcript_chunks(slide_id);

create index if not exists idx_presentation_transcript_chunks_timeline
    on public.presentation_transcript_chunks(presentation_id, chunk_started_at_ms);
