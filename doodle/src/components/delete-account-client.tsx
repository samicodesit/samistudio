"use client";

import { useCallback, useEffect, useState } from "react";
import type { AccountSummary } from "@/app/api/account/route";
import { GoogleSignInButton } from "./google-sign-in-button";

async function readAccount(): Promise<AccountSummary> {
  const response = await fetch("/api/account", { cache: "no-store" });
  if (!response.ok) throw new Error("account_unavailable");
  return (await response.json()) as AccountSummary;
}

export function DeleteAccountClient() {
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAccount = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAccount(await readAccount());
    } catch {
      setError("We could not check your account. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void readAccount()
      .then((nextAccount) => {
        if (active) setAccount(nextAccount);
      })
      .catch(() => {
        if (active) setError("We could not check your account. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function signIn(credential: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/google", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      if (!response.ok) throw new Error("sign_in_failed");
      const nextAccount = await readAccount();
      if (!nextAccount.authenticated) throw new Error("sign_in_failed");
      setAccount(nextAccount);
    } catch {
      setError("Sign-in could not finish. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      if (!response.ok) throw new Error("delete_failed");
      setDeleted(true);
      setAccount(null);
      setConfirming(false);
    } catch {
      setError("Your account could not be deleted. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (deleted) {
    return (
      <section aria-labelledby="account-deleted-title">
        <h2 id="account-deleted-title">Account deleted</h2>
        <p>Your Doodle account and unused doodle credits have been deleted. You are signed out.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="delete-account-action-title">
      <h2 id="delete-account-action-title">Delete your account</h2>
      {loading ? <p role="status">Checking your account…</p> : null}
      {error ? <p className="purchase-error" role="alert">{error}</p> : null}

      {!loading && !account?.authenticated ? (
        <>
          <p>Sign in with the Google account you used for Doodle to manage its deletion.</p>
          <GoogleSignInButton
            locale="en"
            busy={busy}
            onCredential={signIn}
            onError={() => setError("Sign-in could not finish. Please try again.")}
          />
        </>
      ) : null}

      {!loading && account?.authenticated ? (
        <>
          <p>Signed in as <strong dir="ltr">{account.email}</strong>.</p>
          {!confirming ? (
            <button className="purchase-primary" type="button" onClick={() => setConfirming(true)} disabled={busy}>
              Delete my Doodle account
            </button>
          ) : (
            <div aria-labelledby="delete-confirmation-title">
              <h3 id="delete-confirmation-title">Delete permanently?</h3>
              <p>This removes your account and {account.balance} unused {account.balance === 1 ? "doodle credit" : "doodle credits"}. This cannot be undone.</p>
              <div className="purchase-actions">
                <button className="purchase-secondary" type="button" onClick={() => setConfirming(false)} disabled={busy}>
                  Keep account
                </button>
                <button className={`purchase-primary${busy ? " is-loading" : ""}`} type="button" onClick={deleteAccount} disabled={busy} aria-busy={busy}>
                  Delete permanently
                </button>
              </div>
            </div>
          )}
        </>
      ) : null}

      {!loading && !account && error ? (
        <button className="purchase-secondary" type="button" onClick={loadAccount}>Try again</button>
      ) : null}
    </section>
  );
}
