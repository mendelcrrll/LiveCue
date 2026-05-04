create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.presentations (
  id uuid primary key default gen_random_uuid(),
  google_presentation_id text not null unique,
  title text not null,
  locale text,
  revision_id text,
  page_width numeric(12, 2),
  page_height numeric(12, 2),
  page_unit text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.slides (
  id uuid primary key default gen_random_uuid(),
  presentation_id uuid not null references public.presentations(id) on delete cascade,
  google_object_id text not null,
  slide_index integer not null,
  page_type text,
  time_per_slide_seconds integer,
  raw_page jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint uq_slides_presentation_object_id unique (presentation_id, google_object_id),
  constraint uq_slides_presentation_slide_index unique (presentation_id, slide_index),
  constraint ck_slides_time_per_slide_seconds_non_negative check (
    time_per_slide_seconds is null or time_per_slide_seconds >= 0
  )
);

create table if not exists public.slide_priority_items (
  id uuid primary key default gen_random_uuid(),
  slide_id uuid not null references public.slides(id) on delete cascade,
  priority_rank integer not null,
  title text not null,
  notes text,
  extra_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint uq_slide_priority_items_slide_rank unique (slide_id, priority_rank),
  constraint ck_slide_priority_items_priority_rank_positive check (priority_rank > 0)
);

create table if not exists public.slide_pain_points (
  id uuid primary key default gen_random_uuid(),
  slide_id uuid not null references public.slides(id) on delete cascade,
  label text not null,
  severity text,
  details text,
  extra_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_presentations_google_presentation_id
  on public.presentations (google_presentation_id);

create index if not exists idx_slides_presentation_id
  on public.slides (presentation_id);

create index if not exists idx_slide_priority_items_slide_id
  on public.slide_priority_items (slide_id);

create index if not exists idx_slide_pain_points_slide_id
  on public.slide_pain_points (slide_id);

drop trigger if exists trg_presentations_set_updated_at on public.presentations;
create trigger trg_presentations_set_updated_at
before update on public.presentations
for each row
execute function public.set_updated_at();

drop trigger if exists trg_slides_set_updated_at on public.slides;
create trigger trg_slides_set_updated_at
before update on public.slides
for each row
execute function public.set_updated_at();
