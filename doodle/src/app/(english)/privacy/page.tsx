import { ContactEmail, OPERATOR_NAME, LegalPage, legalMetadata } from "@/components/legal-page";

export const metadata = legalMetadata(
  "privacy",
  "Privacy policy",
  "How Doodle collects, uses, shares and protects personal information.",
);

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" intro="This policy explains what information Doodle uses and why.">
      <section>
        <h2>Who operates Doodle</h2>
        <p>Doodle is operated by {OPERATOR_NAME}, publishing as Sami Studio (samistudio.nl) in the Netherlands. For privacy questions or requests, email <ContactEmail />.</p>
      </section>

      <section>
        <h2>Information we process</h2>
        <ul>
          <li><strong>Doodle requests.</strong> The scene you enter is sent to OpenAI to create your image. Doodle does not intentionally save your prompt or generated image in its account database.</li>
          <li><strong>Account information.</strong> If you sign in with Google, we receive your verified Google account identifier and email address. We store a protected identifier, an internal account ID and your doodle balance. Your email is kept in a signed session cookie so the app can show your account.</li>
          <li><strong>Payments.</strong> Stripe processes web payments. Where purchasing is available in the Google Play app, Google Play processes the payment. Doodle verifies purchase status with the payment provider and records transaction references and credit delivery. For Play purchases, a protected account identifier links the purchase to your Doodle account, and a hash of the purchase token prevents duplicate credit delivery. Stripe also supplies the email used at checkout. Doodle does not receive your complete card number.</li>
          <li><strong>Usage and security data.</strong> Necessary cookies remember your free allowance and signed-in session. A protected hash derived from your IP address is used briefly for abuse limits. Hosting and anti-bot providers may process ordinary request, device and network data.</li>
          <li><strong>Analytics.</strong> Vercel Web Analytics measures page visits and events such as successful generation and use of sharing controls to help us improve Doodle. Our custom events do not include your doodle description, image, email or payment token.</li>
          <li><strong>Reports.</strong> If you report a generated doodle, we store the reason and any details you enter. We upload the doodle and its description only when you select the option that clearly asks us to include them for review.</li>
          <li><strong>Messages.</strong> If you contact us, we process your email address and message to reply.</li>
        </ul>
      </section>

      <section>
        <h2>Why we use it</h2>
        <p>We process this information to provide doodles, maintain accounts and balances, complete purchases, prevent abuse, keep the service secure, answer support requests and meet legal obligations.</p>
      </section>

      <section>
        <h2>Service providers</h2>
        <p>Doodle relies on Google for sign-in and Google Play purchases, OpenAI for image generation, Stripe for web payments, Vercel for hosting, analytics and bot protection, and Upstash for account, allowance, balance and report storage. These providers process information under their own terms and privacy commitments. Information may be processed outside the EEA using legally recognized safeguards.</p>
      </section>

      <section>
        <h2>Retention</h2>
        <p>Signed-in sessions last up to 30 days. The anonymous free-allowance cookie and associated count can remain for up to one year. Rate-limit counters expire after about two days. Submitted reports and any included doodle or description are kept for up to 30 days. Account and balance records remain until the account is deleted, while transaction or support records may be kept as required for tax, fraud prevention and legal claims.</p>
      </section>

      <section>
        <h2>Your choices and rights</h2>
        <p>You can delete your Doodle account from the Account menu. Depending on where you live, you may also have rights to access, correct, erase, restrict or object to processing, receive a copy of your data, or complain to a data protection authority. Email <ContactEmail /> to exercise a right.</p>
      </section>

      <section>
        <h2>Children and changes</h2>
        <p>Doodle is not intended for children to create accounts or make purchases without a parent or guardian. We may update this policy when the service or legal requirements change; the date above shows the latest version.</p>
      </section>
    </LegalPage>
  );
}
