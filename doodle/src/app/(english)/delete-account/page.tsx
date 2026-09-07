import Link from "next/link";
import {
  CONTACT_EMAIL,
  LegalPage,
  legalMetadata,
} from "@/components/legal-page";
import { DeleteAccountClient } from "@/components/delete-account-client";

export const metadata = legalMetadata(
  "delete-account",
  "Delete your Doodle account",
  "How to delete your Doodle account and unused doodle credits.",
);

export default function DeleteAccountPage() {
  return (
    <LegalPage
      title="Delete your Doodle account"
      intro="You can delete your account from Doodle in a browser, even if you have uninstalled the app."
    >
      <DeleteAccountClient />

      <section>
        <h2>If sign-in does not work</h2>
        <p>
          Email <a href={`mailto:${CONTACT_EMAIL}?subject=Doodle%20account%20deletion%20help`}>{CONTACT_EMAIL}</a> from the Google email address you used with Doodle for help. Do not send a password, card number or Google credential.
        </p>
      </section>

      <section>
        <h2>What deletion does</h2>
        <p>Deletion removes your Doodle account and unused doodle credits. This cannot be undone, and unused credits cannot be restored.</p>
        <p>Deleting your Doodle account does not delete your Google account.</p>
        <p>Transaction or support records may be kept when required for tax, fraud prevention or legal claims. See the <Link href="/privacy">privacy policy</Link> for details.</p>
      </section>
    </LegalPage>
  );
}
