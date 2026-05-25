create table if not exists public.presentation_audience_vignettes (
    id uuid primary key default gen_random_uuid(),
    presentation_id uuid not null references public.presentations(id) on delete cascade,
    title text not null default '',
    prompt text not null default '',
    sort_order integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_presentation_audience_vignettes_presentation_id
    on public.presentation_audience_vignettes(presentation_id, sort_order);

drop trigger if exists trg_presentation_audience_vignettes_set_updated_at
  on public.presentation_audience_vignettes;
create trigger trg_presentation_audience_vignettes_set_updated_at
before update on public.presentation_audience_vignettes
for each row
execute function public.set_updated_at();

create table if not exists public.presentation_post_feedback_reports (
    id uuid primary key default gen_random_uuid(),
    presentation_id uuid not null references public.presentations(id) on delete cascade,
    model text,
    status text not null default 'completed',
    feedback_data jsonb not null default '{}'::jsonb,
    extra_data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_presentation_post_feedback_reports_presentation_id
    on public.presentation_post_feedback_reports(presentation_id, updated_at desc);

drop trigger if exists trg_presentation_post_feedback_reports_set_updated_at
  on public.presentation_post_feedback_reports;
create trigger trg_presentation_post_feedback_reports_set_updated_at
before update on public.presentation_post_feedback_reports
for each row
execute function public.set_updated_at();
