create table public.credit_balances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('purchase', 'reserve', 'refund')),
  amount integer not null,
  external_id text not null,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now(),
  unique (kind, external_id)
);

create unique index credit_transactions_payment_intent_key
  on public.credit_transactions (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

alter table public.credit_balances enable row level security;
alter table public.credit_transactions enable row level security;

create policy "users read own balance"
  on public.credit_balances for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.reserve_paid_credit(p_user_id uuid, p_reservation_id text)
returns integer language plpgsql security definer set search_path = '' as $$
declare next_balance integer;
begin
  if exists (
    select 1 from public.credit_transactions
    where kind = 'reserve' and external_id = p_reservation_id and user_id = p_user_id
  ) then
    return coalesce((select balance from public.credit_balances where user_id = p_user_id), 0);
  end if;

  update public.credit_balances
    set balance = balance - 1, updated_at = now()
    where user_id = p_user_id and balance > 0
    returning balance into next_balance;
  if not found then return -1; end if;

  insert into public.credit_transactions (user_id, kind, amount, external_id)
  values (p_user_id, 'reserve', -1, p_reservation_id);
  return next_balance;
end;
$$;

create or replace function public.refund_paid_credit(p_user_id uuid, p_reservation_id text)
returns integer language plpgsql security definer set search_path = '' as $$
declare next_balance integer;
begin
  if not exists (
    select 1 from public.credit_transactions
    where kind = 'reserve' and external_id = p_reservation_id and user_id = p_user_id
  ) then
    raise exception 'unknown reservation';
  end if;

  insert into public.credit_transactions (user_id, kind, amount, external_id)
  values (p_user_id, 'refund', 1, p_reservation_id)
  on conflict (kind, external_id) do nothing;
  if not found then
    return coalesce((select balance from public.credit_balances where user_id = p_user_id), 0);
  end if;

  insert into public.credit_balances (user_id, balance)
  values (p_user_id, 1)
  on conflict (user_id) do update
    set balance = public.credit_balances.balance + 1, updated_at = now()
  returning balance into next_balance;
  return next_balance;
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
revoke all on function public.refund_paid_credit(uuid, text) from public, anon, authenticated;
revoke all on function public.fulfill_credit_pack(uuid, text, text) from public, anon, authenticated;
grant execute on function public.reserve_paid_credit(uuid, text) to service_role;
grant execute on function public.refund_paid_credit(uuid, text) to service_role;
grant execute on function public.fulfill_credit_pack(uuid, text, text) to service_role;
