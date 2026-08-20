"use client";

import { LockKeyhole } from "lucide-react";
import { FormEvent, useState } from "react";

interface UnlockFormProps {
  onUnlocked: () => void;
}

export function UnlockForm({ onUnlocked }: UnlockFormProps) {
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passphrase.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase }),
      });
      if (!response.ok) {
        setError("That passphrase is not correct.");
        return;
      }
      setPassphrase("");
      onUnlocked();
    } catch {
      setError("Could not unlock Doodle. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="unlock-panel" aria-labelledby="unlock-title">
      <div className="unlock-icon" aria-hidden="true">
        <LockKeyhole size={18} strokeWidth={1.8} />
      </div>
      <h1 id="unlock-title">Enter the passphrase</h1>
      <p className="unlock-copy">Doodle is a private little space.</p>
      <form onSubmit={handleSubmit} className="unlock-form">
        <label htmlFor="passphrase">Passphrase</label>
        <input
          id="passphrase"
          name="passphrase"
          type="password"
          autoComplete="current-password"
          value={passphrase}
          onChange={(event) => setPassphrase(event.target.value)}
          disabled={isSubmitting}
        />
        <button type="submit" disabled={!passphrase.trim() || isSubmitting}>
          {isSubmitting ? "Unlocking..." : "Unlock"}
        </button>
        <p className="form-message" aria-live="polite">
          {error}
        </p>
      </form>
    </section>
  );
}
