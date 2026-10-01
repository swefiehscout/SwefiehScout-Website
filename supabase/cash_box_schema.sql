-- ============================================================
-- Cash boxes — each group keeps its own physical cash box, separate
-- from the organization's one bank account (which is CliQ-driven and
-- tracked on Admin > Finance > Bank by recording what the bank app
-- shows, not transaction by transaction).
--
-- cash_box_log is an append-only history of everything that happens to
-- a group's box that isn't a normal income/expense entry:
--   opening    the box's starting cash, as of event_date. The newest one
--              wins; earlier ones stay as history.
--   count      someone counted the real cash. amount = what they counted,
--              expected_balance = what the system thought was there; the
--              gap (amount - expected_balance) is the correction.
--   to_bank    cash taken out of the box and deposited in the bank.
--   from_bank  cash taken out of the bank and put in the box.
-- None of these are income or expenses, so they never touch
-- finance_entries or any income/expense report.
--
-- Box balance = latest opening
--             + income - expenses dated on/after the opening date
--             - to_bank + from_bank + count corrections since it.
-- See src/lib/workspace/cash-box.ts.
--
-- Anyone with access to the group can fix a mistaken row (edit or
-- delete it); every change is recorded in finance_audit_log below, so
-- nothing is lost.
-- ============================================================
create table if not exists cash_box_log (
  id uuid primary key default gen_random_uuid(),
  group_key text not null,
  kind text not null check (kind in ('opening', 'count', 'to_bank', 'from_bank')),
  amount numeric(12, 2) not null check (amount >= 0),
  expected_balance numeric(12, 2),
  event_date date not null default current_date,
  note text,
  created_by uuid references auth.users(id) default auth.uid(),
  created_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists cash_box_log_group_idx on cash_box_log (group_key, event_date);

alter table cash_box_log enable row level security;
drop policy if exists "group read" on cash_box_log;
create policy "group read" on cash_box_log
  for select using (has_group_access(group_key));
drop policy if exists "group insert" on cash_box_log;
create policy "group insert" on cash_box_log
  for insert with check (has_group_access(group_key));
drop policy if exists "admin delete" on cash_box_log;
drop policy if exists "group update" on cash_box_log;
create policy "group update" on cash_box_log
  for update using (has_group_access(group_key)) with check (has_group_access(group_key));
drop policy if exists "group delete" on cash_box_log;
create policy "group delete" on cash_box_log
  for delete using (has_group_access(group_key));

alter table cash_box_log add column if not exists updated_at timestamptz;
alter table cash_box_log add column if not exists updated_by_name text;

-- Bank checks (finance_reconciliations) no longer post adjustment
-- entries — they just record what the bank app showed, next to what the
-- system expected. Who saved the bank opening balance is tracked too.
alter table org_finance_settings add column if not exists updated_by_name text;

-- ============================================================
-- finance_audit_log — every add, edit, and delete on the money tables,
-- written by database triggers (so nothing can skip it, whichever page
-- or automatic sync made the change). Shown on Finance > Activity Log,
-- per group in the Leaders Workspace and org-wide in Admin.
--   old_data / new_data   the full row before / after (null on add / delete)
--   group_key             null for the org-level bank tables (admin only)
-- Nobody can edit or delete these rows from the app.
-- ============================================================
create table if not exists finance_audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  row_id text,
  group_key text,
  old_data jsonb,
  new_data jsonb,
  changed_by uuid default auth.uid(),
  changed_by_name text,
  changed_at timestamptz not null default now()
);

create index if not exists finance_audit_log_group_idx on finance_audit_log (group_key, changed_at desc);

alter table finance_audit_log enable row level security;
drop policy if exists "read own groups" on finance_audit_log;
create policy "read own groups" on finance_audit_log
  for select using (
    (group_key is not null and has_group_access(group_key))
    or (group_key is null and is_admin())
  );

create or replace function log_finance_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rec jsonb;
  who text;
begin
  rec := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  select name into who from profiles where id = auth.uid();
  insert into finance_audit_log (table_name, action, row_id, group_key, old_data, new_data, changed_by, changed_by_name)
  values (
    tg_table_name,
    lower(tg_op),
    rec->>'id',
    rec->>'group_key',
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end,
    auth.uid(),
    who
  );
  return null;
end;
$$;

drop trigger if exists trg_audit_finance_entries on finance_entries;
create trigger trg_audit_finance_entries
  after insert or update or delete on finance_entries
  for each row execute function log_finance_change();

drop trigger if exists trg_audit_cash_box_log on cash_box_log;
create trigger trg_audit_cash_box_log
  after insert or update or delete on cash_box_log
  for each row execute function log_finance_change();

drop trigger if exists trg_audit_finance_reconciliations on finance_reconciliations;
create trigger trg_audit_finance_reconciliations
  after insert or update or delete on finance_reconciliations
  for each row execute function log_finance_change();

drop trigger if exists trg_audit_org_finance_settings on org_finance_settings;
create trigger trg_audit_org_finance_settings
  after update on org_finance_settings
  for each row execute function log_finance_change();
