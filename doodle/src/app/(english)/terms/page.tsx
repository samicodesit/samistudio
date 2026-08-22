import { ContactEmail, LegalPage, legalMetadata } from "@/components/legal-page";

export const metadata = legalMetadata(
  "terms",
  "Terms of service",
  "The terms that apply when you use Doodle or purchase doodle credits.",
);

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service" intro="These terms apply when you use Doodle or buy doodle credits.">
      <section>
        <h2>The service</h2>
        <p>Doodle turns a short text description into an AI-generated drawing. Results can vary, take time, fail or be refused. We may change, suspend or discontinue features when reasonably necessary.</p>
      </section>

      <section>
        <h2>Accounts and acceptable use</h2>
        <p>You are responsible for activity through your account. Do not use Doodle unlawfully, attempt to bypass usage limits, interfere with the service, generate abusive or infringing material, or automate access without permission. We may restrict access where needed to protect Doodle or others.</p>
      </section>

      <section>
        <h2>Purchases</h2>
        <p>Doodle sells a one-time pack of 10 doodle credits for €4.99. There is no subscription. The final total, including any applicable tax, is shown by Stripe before payment. One credit is used only when a generation completes successfully. Credits have no cash value and cannot be transferred between accounts.</p>
      </section>

      <section>
        <h2>Your images</h2>
        <p>Subject to applicable law and third-party rights, you may use and download images created for you. AI output may not be unique, accurate or free of similarities to other material. You are responsible for checking whether your intended use is lawful and appropriate.</p>
      </section>

      <section>
        <h2>Liability</h2>
        <p>Doodle is provided on an “as available” basis. To the fullest extent allowed by law, Sami Studio is not liable for indirect or consequential loss. Nothing in these terms excludes liability or consumer rights that cannot legally be excluded.</p>
      </section>

      <section>
        <h2>Ending use and governing law</h2>
        <p>You may stop using Doodle or delete your account at any time. Deleting an account removes unused credits and cannot be undone. These terms are governed by Slovak law, without depriving consumers of mandatory protections available where they live.</p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>Doodle is operated by Sami Studio in Slovakia. Questions can be sent to <ContactEmail />.</p>
      </section>
    </LegalPage>
  );
}
