import { CONTACT_EMAIL, LegalPage, legalMetadata } from "@/components/legal-page";

export const metadata = legalMetadata(
  "contact",
  "Contact",
  "Contact Sami Studio about Doodle support, payments, privacy or refunds.",
);

export default function ContactPage() {
  return (
    <LegalPage title="Contact" intro="Need help with Doodle, a payment or your account? Send us an email.">
      <section>
        <h2>Email</h2>
        <p><a className="legal-contact-link" href={`mailto:${CONTACT_EMAIL}`}>Email Sami Studio</a></p>
        <p><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
      </section>

      <section>
        <h2>What to include</h2>
        <p>For account, credit or payment help, include the Google account email used with Doodle and the approximate time of the issue. Do not send card numbers, passwords or Google credentials.</p>
      </section>

      <section>
        <h2>Operator</h2>
        <p>Sami Studio<br />Slovakia</p>
      </section>
    </LegalPage>
  );
}
