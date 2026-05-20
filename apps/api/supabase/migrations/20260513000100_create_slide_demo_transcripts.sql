create table if not exists public.slide_demo_transcripts (
  id uuid primary key default gen_random_uuid(),
  slide_id uuid not null references public.slides(id) on delete cascade,
  transcript text not null default '',
  source text not null default 'manual',
  extra_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint uq_slide_demo_transcripts_slide_id unique (slide_id)
);

create index if not exists idx_slide_demo_transcripts_slide_id
  on public.slide_demo_transcripts (slide_id);

insert into public.slide_demo_transcripts (slide_id, transcript, source)
select
  slides.id,
  slides.raw_page ->> 'demoTranscript',
  'migration'
from public.slides
where
  slides.raw_page ? 'demoTranscript'
  and length(trim(coalesce(slides.raw_page ->> 'demoTranscript', ''))) > 0
on conflict (slide_id) do update
set
  transcript = excluded.transcript,
  source = excluded.source,
  updated_at = timezone('utc', now());

update public.slides
set raw_page = raw_page - 'demoTranscript'
where raw_page ? 'demoTranscript';

drop trigger if exists trg_slide_demo_transcripts_set_updated_at
  on public.slide_demo_transcripts;
create trigger trg_slide_demo_transcripts_set_updated_at
before update on public.slide_demo_transcripts
for each row
execute function public.set_updated_at();
