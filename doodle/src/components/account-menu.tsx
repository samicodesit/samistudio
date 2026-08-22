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
  const [busy, setBusy] = useState<"signOut" | "delete" | null>(null);

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (detailsRef.current?.contains(target) || dialogRef.current?.contains(target)) return;
      detailsRef.current?.removeAttribute("open");
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !confirmingDelete) detailsRef.current?.removeAttribute("open");
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [confirmingDelete]);

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
    setBusy("signOut");
    const response = await fetch("/api/auth/sign-out", { method: "POST" });
    if (response.ok) await refreshAccount();
    setBusy(null);
  }

  async function deleteAccount() {
    setBusy("delete");
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
    setBusy(null);
  }

  return (
    <>
      <details ref={detailsRef} className="account-menu">
        <summary title={copy.label}>
          <span className="account-initial" aria-hidden="true">{account.email?.trim().charAt(0).toUpperCase() || "•"}</span>
          <span className="sr-only">{copy.label}</span>
        </summary>
        <div className="account-popover">
          <p className="account-email" dir="ltr">{account.email}</p>
          <p className="account-balance">{formatCount(locale, copy.balance, account.balance)}</p>
          <button className={busy === "signOut" ? "is-loading" : undefined} type="button" onClick={signOut} disabled={busy !== null} aria-busy={busy === "signOut"}>{copy.signOut}</button>
          <button ref={deleteTriggerRef} className="account-delete" type="button" onClick={() => setConfirmingDelete(true)} disabled={busy !== null}>
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
              <button type="button" data-delete-cancel onClick={() => setConfirmingDelete(false)} disabled={busy !== null}>
                {copy.cancelDelete}
              </button>
              <button className={`account-delete-confirm${busy === "delete" ? " is-loading" : ""}`} type="button" onClick={deleteAccount} disabled={busy !== null} aria-busy={busy === "delete"}>
                {copy.confirmDelete}
              </button>
            </div>
          </div>
        </dialog>
      ) : null}
    </>
  );
}
