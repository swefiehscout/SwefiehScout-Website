-- Swefieh Scout — Approvals "Transfer" (leaders/app.astro,
-- startTransferRequest()) needs to repoint a join_requests row's
-- group_key to a group the acting leader has no access to at all — the
-- whole point is handing a misfiled /join request (usually the wrong
-- age band, since the public form doesn't check that) straight to
-- whichever group actually owns it, without that group's leader having
-- to do anything first. schema.sql's own "group leaders can update"
-- required has_group_access() on BOTH the row's current group_key
-- (`using`) and the new one (`with check`), which blocked exactly that
-- move. This keeps the `using` gate as-is — a leader still needs
-- access to whichever group a request is CURRENTLY sitting in before
-- they can touch it at all, same as approving/rejecting it — but drops
-- `with check` down to unconditional, so the new group_key can be
-- anything. Once transferred, the row falls out of that leader's own
-- SELECT (schema.sql's "group leaders can view" is untouched, still
-- has_group_access()-gated) and shows up in the destination group's
-- Approvals instead. Run this AFTER schema.sql. Safe to re-run.

drop policy if exists "group leaders can update" on join_requests;
drop policy if exists "group leaders can update or transfer" on join_requests;
create policy "group leaders can update or transfer" on join_requests
  for update using (has_group_access(group_key)) with check (true);
