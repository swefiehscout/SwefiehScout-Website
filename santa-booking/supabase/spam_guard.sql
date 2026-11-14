-- =====================================================================
-- Spam guard for the Contact page. Run once in Supabase → SQL Editor
-- (Santa Booking project), after audit_fixes.sql. Safe to run again.
--
--  • Contact messages that look like spam go to a separate table
--    (messages_spam) instead of the team's Messages list. Nothing is
--    thrown away, so a real message caught by mistake can be moved back
--    (see the bottom of this file).
--  • A message counts as spam when:
--      - it didn't come from the Contact page (no page timer, or the
--        hidden "website" field that only bots fill in has text in it);
--      - it was sent less than 3 seconds after the page opened;
--      - it has a link that isn't a Google Maps link;
--      - it is written in Cyrillic (Russian) or Chinese/Japanese/Korean script;
--      - the same text was already sent in the last 24 hours.
--  • The same phone number or email can send at most 3 messages an hour.
--  • The sender always sees "sent", so bots learn nothing.
--  • Spam already in Messages is moved out when you run this (see the end).
-- =====================================================================

-- Where spam goes. Only the team can read it.
create table if not exists messages_spam (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name       text not null default '',
  phone      text not null default '',
  email      text not null default '',
  message    text not null default '',
  reason     text not null default ''
);
alter table messages_spam enable row level security;
drop policy if exists admin_all on messages_spam;
create policy admin_all on messages_spam for all to authenticated using (is_admin()) with check (is_admin());

-- Spam check shared by the Contact form and the clean-up below.
-- Returns why a message looks like spam, or null when it looks fine.
create or replace function message_spam_reason(p_message text)
returns text
language sql immutable set search_path = public as $$
  select case
    -- links other than Google Maps (families sometimes paste their map link)
    when regexp_replace(coalesce(p_message, ''),
           '(https?://)?(www\.)?(maps\.app\.goo\.gl|goo\.gl/maps|maps\.google\.[a-z.]+|google\.[a-z.]+/maps)[^[:space:]]*',
           '', 'gi') ~* '(https?://|www\.)' then 'link'
    -- Cyrillic, Chinese, Japanese or Korean script
    when coalesce(p_message, '') ~ '[Ѐ-ӿ぀-ヿ㐀-鿿가-힯]' then 'script'
    else null
  end;
$$;

-- The Contact form. The old 4-argument version is replaced so every message
-- goes through the checks (calls without the page timer count as spam).
drop function if exists public_message(text, text, text, text);
create or replace function public_message(
  p_name text, p_phone text, p_email text, p_message text,
  p_website text default null, p_elapsed_ms int default null)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_name    text := trim(coalesce(p_name, ''));
  v_phone   text := trim(coalesce(p_phone, ''));
  v_email   text := lower(trim(coalesce(p_email, '')));
  v_message text := trim(coalesce(p_message, ''));
  v_digits  text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_reason  text;
begin
  if length(v_name) < 2 or length(v_message) < 2 then
    return jsonb_build_object('ok', false, 'reason', 'missing');
  end if;
  if length(v_message) > 4000 or length(v_name) > 120 or length(v_phone) > 40 or length(v_email) > 200 then
    return jsonb_build_object('ok', false, 'reason', 'long');
  end if;

  -- Overall cap (as before): at most 20 messages in any 10 minutes.
  if (select count(*) from messages where created_at > now() - interval '10 minutes') >= 20 then
    return jsonb_build_object('ok', false, 'reason', 'busy');
  end if;

  -- Same phone or email: at most 3 messages an hour.
  if (length(v_digits) >= 7 and (select count(*) from messages
        where created_at > now() - interval '1 hour'
          and regexp_replace(phone, '[^0-9]', '', 'g') = v_digits) >= 3)
     or (v_email <> '' and (select count(*) from messages
        where created_at > now() - interval '1 hour' and lower(email) = v_email) >= 3) then
    return jsonb_build_object('ok', false, 'reason', 'busy');
  end if;

  v_reason := case
    when p_elapsed_ms is null then 'not from the page'
    when coalesce(trim(p_website), '') <> '' then 'hidden field filled'
    when p_elapsed_ms < 3000 then 'sent too fast'
    else message_spam_reason(v_message)
  end;
  if v_reason is null and exists (select 1 from messages
       where created_at > now() - interval '24 hours' and message = v_message) then
    v_reason := 'duplicate';
  end if;

  if v_reason is not null then
    -- Keep at most 2,000 spam rows a day so a flood can't fill the database.
    if (select count(*) from messages_spam where created_at > now() - interval '24 hours') < 2000 then
      insert into messages_spam (name, phone, email, message, reason)
      values (left(v_name, 120), left(v_phone, 40), left(v_email, 200), left(v_message, 4000), v_reason);
    end if;
    return jsonb_build_object('ok', true);   -- looks "sent" to the sender
  end if;

  insert into messages (name, phone, email, message)
  values (v_name, v_phone, v_email, v_message);
  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function message_spam_reason(text) from public, anon, authenticated;
revoke execute on function public_message(text, text, text, text, text, int) from public;
grant execute on function public_message(text, text, text, text, text, int) to anon, authenticated;

-- =====================================================================
-- Clean-up: spam already in the Messages list is moved out now.
-- It goes to messages_spam (hidden), so nothing is lost. Caught here:
--   - messages with links other than Google Maps, or in Cyrillic/CJK script;
--   - the same text sent more than once (the first copy stays in Messages).
-- =====================================================================
with flagged as (
  select id, coalesce(message_spam_reason(message),
           case when row_number() over (partition by message order by created_at) > 1 then 'duplicate' end) as reason
  from messages
),
moved as (
  delete from messages m using flagged f
  where m.id = f.id and f.reason is not null
  returning m.created_at, m.name, m.phone, m.email, m.message, f.reason
)
insert into messages_spam (created_at, name, phone, email, message, reason)
select created_at, name, phone, email, message, reason from moved;

-- How many are left in Messages, and how many were moved to spam:
select (select count(*) from messages) as messages_left,
       (select count(*) from messages_spam) as spam_total;

-- =====================================================================
-- Handy later (run one at a time):
--
-- See the spam that was caught:
--    select created_at, reason, name, phone, left(message, 80) from messages_spam order by created_at desc;
--
-- Put a real message back (replace the id):
--    with back as (delete from messages_spam where id = '...' returning *)
--    insert into messages (created_at, name, phone, email, message)
--    select created_at, name, phone, email, message from back;
--
-- Empty the spam table for good:
--    delete from messages_spam;
-- =====================================================================
