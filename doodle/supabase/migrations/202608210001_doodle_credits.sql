create table public.credit_balances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('purchase', 'generation')),
  amount integer not null,
  external_id text not null,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now(),
  unique (kind, external_id)
);

create unique index credit_transactions_payment_intent_key
  on public.credit_transactions (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create table public.credit_holds (
  reservation_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  finalized_at timestamptz,
  created_at timestamptz not null default now()
);

create index credit_holds_user_expiry_idx
  on public.credit_holds (user_id, expires_at)
  where finalized_at is null;

alter table public.credit_balances enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.credit_holds enable row level security;

create policy "users read own balance"
  on public.credit_balances for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.reserve_paid_credit(p_user_id uuid, p_reservation_id text)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  current_balance integer;
  active_holds integer;
begin
  insert into public.credit_balances (user_id, balance)
  values (p_user_id, 0)
  on conflict (user_id) do nothing;

  select balance into current_balance
  from public.credit_balances
  where user_id = p_user_id
  for update;

  delete from public.credit_holds
  where user_id = p_user_id and finalized_at is null and expires_at <= now();

  if exists (
    select 1 from public.credit_holds
    where reservation_id = p_reservation_id
      and user_id = p_user_id
      and finalized_at is null
      and expires_at > now()
  ) then
    select count(*) into active_holds
    from public.credit_holds
    where user_id = p_user_id and finalized_at is null and expires_at > now();
    return greatest(0, current_balance - active_holds);
  end if;

  select count(*) into active_holds
  from public.credit_holds
  where user_id = p_user_id and finalized_at is null and expires_at > now();
  if current_balance <= active_holds then return -1; end if;

  insert into public.credit_holds (reservation_id, user_id, expires_at)
  values (p_reservation_id, p_user_id, now() + interval '10 minutes');
  return current_balance - active_holds - 1;
end;
$$;

create or replace function public.finalize_paid_credit(p_user_id uuid, p_reservation_id text)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  current_balance integer;
  hold_expires timestamptz;
  hold_finalized timestamptz;
begin
  select balance into current_balance
  from public.credit_balances
  where user_id = p_user_id
  for update;
  if not found then return -1; end if;

  select expires_at, finalized_at into hold_expires, hold_finalized
  from public.credit_holds
  where reservation_id = p_reservation_id and user_id = p_user_id
  for update;
  if not found then return -1; end if;
  if hold_finalized is not null then return current_balance; end if;
  if hold_expires <= now() then return -1; end if;

  update public.credit_balances
  set balance = balance - 1, updated_at = now()
  where user_id = p_user_id and balance > 0
  returning balance into current_balance;
  if not found then return -1; end if;

  update public.credit_holds
  set finalized_at = now()
  where reservation_id = p_reservation_id;

  insert into public.credit_transactions (user_id, kind, amount, external_id)
  values (p_user_id, 'generation', -1, p_reservation_id);
  return current_balance;
end;
$$;

create or replace function public.release_paid_credit(p_user_id uuid, p_reservation_id text)
returns integer language plpgsql security definer set search_path = '' as $$
begin
  delete from public.credit_holds
  where reservation_id = p_reservation_id
    and user_id = p_user_id
    and finalized_at is null;
  return case when found then 1 else 0 end;
end;
$$;

create or replace function public.fulfill_credit_pack(
  p_user_id uuid,
  p_checkout_session_id text,
  p_payment_intent_id text
)
returns integer language plpgsql security definer set search_path = '' as $$
declare next_balance integer;
begin
  insert into public.credit_transactions (
    user_id, kind, amount, external_id, stripe_payment_intent_id
  ) values (
    p_user_id, 'purchase', 10, p_checkout_session_id, p_payment_intent_id
  ) on conflict do nothing;
  if not found then
    return coalesce((select balance from public.credit_balances where user_id = p_user_id), 0);
  end if;

  insert into public.credit_balances (user_id, balance)
  values (p_user_id, 10)
  on conflict (user_id) do update
    set balance = public.credit_balances.balance + 10, updated_at = now()
  returning balance into next_balance;
  return next_balance;
end;
$$;

revoke all on function public.reserve_paid_credit(uuid, text) from public, anon, authenticated;
revoke all on function public.finalize_paid_credit(uuid, text) from public, anon, authenticated;
revoke all on function public.release_paid_credit(uuid, text) from public, anon, authenticated;
revoke all on function public.fulfill_credit_pack(uuid, text, text) from public, anon, authenticated;
grant execute on function public.reserve_paid_credit(uuid, text) to service_role;
grant execute on function public.finalize_paid_credit(uuid, text) to service_role;
grant execute on function public.release_paid_credit(uuid, text) to service_role;
grant execute on function public.fulfill_credit_pack(uuid, text, text) to service_role;
