create table if not exists public.workflow_nodes (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.workflow_nodes(id) on delete cascade,
  presentation_id uuid references public.presentations(id) on delete set null,
  name text not null,
  node_type text not null,
  source_kind text not null default 'manual',
  google_presentation_id text,
  system_key text unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint ck_workflow_nodes_node_type check (node_type in ('folder', 'file'))
);

create index if not exists idx_workflow_nodes_parent_id
  on public.workflow_nodes (parent_id, sort_order);

create index if not exists idx_workflow_nodes_presentation_id
  on public.workflow_nodes (presentation_id);

drop trigger if exists trg_workflow_nodes_set_updated_at on public.workflow_nodes;
create trigger trg_workflow_nodes_set_updated_at
before update on public.workflow_nodes
for each row
execute function public.set_updated_at();
