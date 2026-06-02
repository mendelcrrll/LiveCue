alter table public.workflow_nodes
  add column if not exists owner_user_id text;

create index if not exists idx_workflow_nodes_owner_user_id
  on public.workflow_nodes (owner_user_id);
