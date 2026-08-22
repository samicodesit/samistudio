"use client";

import { useEffect, useRef, useState } from "react";
import type { AccountSummary } from "@/app/api/account/route";
import { formatCount, type DoodleCopy, type Locale } from "@/lib/i18n";

interface AccountMenuProps {
  account: AccountSummary;
  locale: Locale;
  copy: DoodleCopy["account"];
  onAccountChange: (account: AccountSummary) => void;
}

export function AccountMenu({ account, locale, copy, onAccountChange }: AccountMenuProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    const deleteTrigger = deleteTriggerRef.current;
    if (!dialog || !confirmingDelete) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    const frame = requestAnimationFrame(() => dialog.querySelector<HTMLButtonElement>("[data-delete-cancel]")?.focus());
    return () => {
      cancelAnimationFrame(frame);
      if (dialog.open && typeof dialog.close === "function") dialog.close();
      deleteTrigger?.focus();
    };
  }, [confirmingDelete]);

  if (!account.authenticated) return null;

  async function refreshAccount() {
    const response = await fetch("/api/account", { cache: "no-store" });
    if (!response.ok) return;
    onAccountChange((await response.json()) as AccountSummary);
    detailsRef.current?.removeAttribute("open");
  }

  async function signOut() {
    setBusy(true);
    const response = await fetch("/api/auth/sign-out", { method: "POST" });
    if (response.ok) await refreshAccount();
    setBusy(false);
  }

  async function deleteAccount() {
    setBusy(true);
    const response = await fetch("/api/account", {
      method: "DELETE",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: true }),
    });
    if (response.ok) {
      await refreshAccount();
      setConfirmingDelete(false);
    }
    setBusy(false);
  }

  return (
    <>
      <details ref={detailsRef} className="account-menu">
        <summary>{copy.label}</summary>
        <div className="account-popover">
          <p className="account-email" dir="ltr">{account.email}</p>
          <p>{formatCount(locale, copy.balance, account.balance)}</p>
          <button type="button" onClick={signOut} disabled={busy}>{copy.signOut}</button>
          <button ref={deleteTriggerRef} className="account-delete" type="button" onClick={() => setConfirmingDelete(true)} disabled={busy}>
            {copy.delete}
          </button>
        </div>
      </details>
      {confirmingDelete ? (
        <dialog
          ref={dialogRef}
          className="account-delete-dialog"
          aria-labelledby="delete-account-title"
          onCancel={(event) => {
            event.preventDefault();
            setConfirmingDelete(false);
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) setConfirmingDelete(false);
          }}
        >
          <div className="account-delete-card">
            <h2 id="delete-account-title">{copy.delete}</h2>
            <p>{copy.deleteWarning}</p>
            <div className="account-delete-actions">
              <button type="button" data-delete-cancel onClick={() => setConfirmingDelete(false)} disabled={busy}>
                {copy.cancelDelete}
              </button>
              <button className="account-delete-confirm" type="button" onClick={deleteAccount} disabled={busy}>
                {copy.confirmDelete}
              </button>
            </div>
          </div>
        </dialog>
      ) : null}
    </>
  );
}
