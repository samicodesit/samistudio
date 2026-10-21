import { ContactEmail, OPERATOR_NAME, LegalPage, legalMetadata } from "@/components/legal-page";

export const metadata = legalMetadata(
  "privacy",
  "Privacy policy",
  "How Doodle collects, uses, shares and protects personal information.",
);

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" intro="This policy explains what information Doodle uses and why." updated="October 13, 2026">
      <section>
        <h2>Who operates Doodle</h2>
        <p>Doodle is operated by {OPERATOR_NAME}, publishing as Sami Studio (samistudio.nl) in the Netherlands. For privacy questions or requests, email <ContactEmail />.</p>
      </section>

      <section>
        <h2>Information we process</h2>
        <ul>
          <li><strong>Doodle requests.</strong> The description you enter and any photo you choose are sent through Doodle to OpenAI to create your drawing. In the native app, we ask for your permission before the first generation. You can cancel without sending content, read this policy, or withdraw permission in Settings so we ask again before your next drawing. Photos are resized and metadata such as location is removed before they are sent. Doodle does not save your description, source photo or generated image in its account database. Choosing a photo alone does not upload it. Photos are optional; you can create a doodle from a description instead.</li>
          <li><strong>Account information.</strong> If you sign in with Google or Apple, we receive the provider’s verified account identifier and an email address when supplied. Apple may provide a private relay email, or no email on a returning sign-in. We store a protected identifier, an internal account ID and your doodle balance. Your email is used in the signed-in session to show your account. Native sessions use an opaque access token stored securely on your device. For Apple sign-in, we also store an encrypted authorization token so we can revoke access when you delete your account. Apple and Google accounts have separate balances and are not automatically linked by email.</li>
          <li><strong>Complimentary credits.</strong> If we give you extra doodle credits, we record the amount, date and reason against your existing account. A protected account identifier separates gift recipients&apos; drawing usage and operational totals from regular usage reporting. The gift itself is not recorded as a purchase.</li>
          <li><strong>Payments.</strong> Stripe processes web payments. Where purchasing is available in the native apps, Google Play or Apple processes the payment. Doodle verifies purchase status with the payment provider and records transaction references and credit delivery. For Play purchases, a protected account identifier links the purchase to your Doodle account, and a hash of the purchase token prevents duplicate credit delivery. For Apple purchases, a random checkout reference links the purchase to your account and the promised credits. Verified transaction references prevent duplicate delivery and let us process refunds and reversals. Test purchases use a separate balance and are excluded from real purchase totals. Stripe also supplies the email used at checkout. Doodle does not receive your complete card number.</li>
          <li><strong>Usage and security data.</strong> Necessary cookies remember your free allowance and signed-in session. A protected hash derived from your IP address is used briefly for abuse limits. Hosting and anti-bot providers may process ordinary request, device and network data.</li>
          <li><strong>Analytics.</strong> Vercel Web Analytics measures page visits and events such as successful generation and use of sharing controls to help us improve Doodle. It also processes browser and device information, referring pages and approximate location such as city, region or country. It does not request GPS access. Our custom events do not include your doodle description, image, email or payment token.</li>
          <li><strong>Usage counts.</strong> We count successful drawings and newly delivered paid credit packs by day, separately for Android, iOS and web. We also keep daily totals of generation outcomes, server processing times, exhausted-credit requests and web checkout or wallet-session setup outcomes to find service problems. These counts exclude known testing accounts and test purchases where identifiable. Existing protected testing identifiers help exclude testing activity. Hashed operation references prevent duplicate drawing and purchase counts; the new operational totals do not store additional visitor or operation identifiers. The counts contain no prompt, image, email or raw purchase token, and do not add cookies or advertising identifiers.</li>
          <li><strong>Pack usage.</strong> We count retained identities that complete their first drawing, finish the four free drawings, or open the purchase screen at zero credits. Protected versions of existing allowance and account identifiers avoid counting the same identity twice after sign-in. We record newly delivered packs, their credit quantity and whether a launch bonus applied. This does not add an advertising identifier or link purchases to an install source. Known testing activity is excluded, and gifted activity is reported separately. A local purchase-history flag helps the app choose refill wording. It is not an identifier, is not sent for analytics, and is removed from the app when you delete your account.</li>
          <li><strong>Reports.</strong> If you report a generated doodle, we store the reason and any details you enter. We upload the doodle and its description only when you select the option that clearly asks us to include them for review.</li>
          <li><strong>Diagnostics.</strong> The native apps keep a limited failure log on your device: UTC time, app version and build, operating-system version information, failure stage and code, and a random request reference. This file is not uploaded automatically. You can choose to share it from Settings to help us investigate a problem. It excludes your doodle description, image, email, account identifier, payment receipt and authentication tokens. Our servers separately record limited request and failure metadata, including request references, response codes and processing times. Hosting providers may also retain network information such as IP addresses in request logs.</li>
          <li><strong>Messages.</strong> If you contact us, we process your email address and message to reply.</li>
        </ul>
      </section>

      <section>
        <h2>Why we use it</h2>
        <p>We process this information to provide doodles, maintain accounts and balances, complete purchases, understand service usage, prevent abuse, keep the service secure, answer support requests and meet legal obligations.</p>
        <p>We use minimal backend operational counts in our legitimate interest in maintaining a reliable service. We aggregate them by day and do not use them to create advertising profiles or track people across services.</p>
      </section>

      <section>
        <h2>Service providers</h2>
        <p>Doodle relies on Apple for Apple sign-in and App Store purchases, Google for Google sign-in, Google Play purchases and billing diagnostics, OpenAI for image generation, Stripe for web payments, Vercel for hosting, analytics and bot protection, and Upstash for account, allowance, balance, usage-count, diagnostic and report storage. These providers process information under their own terms and privacy commitments. Information may be processed outside the EEA using legally recognized safeguards.</p>
        <p>Google’s bundled sign-in SDK privacy manifest declares profile/contact data such as name, email and phone number, user/device identifiers, approximate location, usage data and other data used for sign-in and analytics. Doodle itself reads the verified account identifier and email. Google may estimate general location from your IP address for fraud prevention; Doodle does not request GPS access. See <a href="https://developers.google.com/identity/sign-in/ios/app-privacy">Google’s sign-in privacy disclosures</a>.</p>
      </section>

      <section>
        <h2>Retention</h2>
        <p>Photo drafts stay on your device so you can finish after signing in or buying credits. On the web, photo drafts and a drawing preserved for a checkout or sign-in return expire after 30 minutes and are removed from local storage the next time Doodle accesses that storage. Removing a photo clears its draft immediately. Starting a new doodle clears the temporary drafts. In the native apps, a temporary photo copy remains in the app&apos;s private cache while you work and is removed when you replace or remove it, start a new doodle or close the active app session. The operating system may also clear cached files; an interrupted session can leave a temporary copy until the cache is cleared. Our server processes the photo in memory to request the doodle and does not create a stored photo library.</p>
        <p>Signed-in sessions last up to 30 days. The anonymous free-allowance cookie and associated count can remain for up to one year. Rate-limit counters expire after about two days. Submitted reports and any included doodle or description are kept for up to 30 days. Account and balance records remain until the account is deleted, while transaction or support records may be kept as required for tax, fraud prevention and legal claims.</p>
        <p>Native failure records are kept for up to seven days on your device. Our structured server failure records expire within 30 days after their storage day ends. If you choose to share your diagnostic file with support, we keep that copy only as needed to resolve your request. Hosting providers have separate request-log retention periods.</p>
        <p>Daily usage counts and hashed duplicate references expire after 366 days. Protected identifiers of known testing accounts remain excluded from these counts.</p>
        <p>Protected pack-count identities and sign-in aliases expire after 366 days and are removed when the associated account is deleted. Daily purchase totals retain no account identifier. Checkout promises, including the selected pack and promised credits, are retained for up to 366 days so delayed purchases receive the promised quantity. Purchase and credit-delivery records can remain for the transaction reasons above.</p>
        <p>The additional daily operational totals expire after 90 days.</p>
        <p>Complimentary credit records and the gift-recipient label remain while your account exists and are removed when you delete it. Daily aggregate counts keep the retention periods above.</p>
        <p>Service providers have separate retention periods. OpenAI may keep generation content in abuse-monitoring logs for up to 30 days by default, with exceptions for legal requirements and safety review of flagged image inputs. Doodle does not claim zero retention at OpenAI or immediate removal of those provider logs when you delete your Doodle account. Vercel discards its analytics visitor-session identifier after 24 hours; aggregate statistics may remain. See <a href="https://developers.openai.com/api/docs/guides/your-data">OpenAI data controls</a> and <a href="https://vercel.com/docs/analytics/privacy-policy">Vercel Analytics privacy information</a>.</p>
      </section>

      <section>
        <h2>Your choices and rights</h2>
        <p>The native app remembers your AI sharing permission locally as a versioned choice. You can withdraw it in Settings; this prevents future generation until you give permission again and does not recall previously submitted content. You can delete your Doodle account from the Account menu or the delete-account page on our website. This removes your account mapping, balance, gift records and associated protected funnel identities and aliases. Daily purchase totals contain no account identifier. Minimal transaction records, checkout promises and deletion safeguards may remain for fraud prevention, delayed purchase handling and legal obligations. Removing a local photo draft does not recall a photo already submitted for generation. For a privacy request concerning service-provider processing, email us. Depending on where you live, you may also have rights to access, correct, erase, restrict or object to processing, receive a copy of your data, or complain to a data protection authority. Email <ContactEmail /> to exercise a right.</p>
      </section>

      <section>
        <h2>Children and changes</h2>
        <p>Doodle is not intended for children to create accounts or make purchases without a parent or guardian. We may update this policy when the service or legal requirements change; the date above shows the latest version.</p>
      </section>
    </LegalPage>
  );
}
