import { ContactEmail, LegalPage, legalMetadata } from "@/components/legal-page";

export const metadata = legalMetadata(
  "refund",
  "Refund policy",
  "Refunds, failed generations and withdrawal rights for Doodle credit purchases.",
);

export default function RefundPage() {
  return (
    <LegalPage title="Refund policy" intro="Doodle sells one-time credit packs, never subscriptions.">
      <section>
        <h2>Fourteen-day requests</h2>
        <p>You may ask to cancel an unused purchase within 14 days of payment by emailing <ContactEmail />. Include the Google account email used for Doodle and the approximate purchase date so we can locate the payment.</p>
      </section>

      <section>
        <h2>Used credits and failed generations</h2>
        <p>Credits already used for successfully delivered doodles are normally non-refundable. Failed generations do not use a doodle credit. If a technical error deducted a credit or a duplicate charge occurred, contact us and we will investigate and correct it.</p>
      </section>

      <section>
        <h2>Mandatory consumer rights</h2>
        <p>This policy does not limit any mandatory right you have under applicable consumer law, including withdrawal and remedies for faulty digital services. Where the law entitles you to more than this policy provides, the law applies.</p>
      </section>

      <section>
        <h2>How refunds are paid</h2>
        <p>Approved refunds are returned through Stripe to the original payment method. Your bank or card provider controls how long the refund takes to appear.</p>
      </section>

      <section>
        <h2>Withdrawal notice</h2>
        <p>You may use this wording by email: “I give notice that I withdraw from my Doodle credit purchase,” followed by your name, account email, purchase date and the date of your request.</p>
      </section>
    </LegalPage>
  );
}
