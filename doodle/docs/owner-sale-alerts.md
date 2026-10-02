# Owner sale alerts

Published October 2, 2026. Backend deployment `dpl_AZEAApa8iuYzBKJQkiutJH2np3As`, source `efbf572`, is READY and aliased to https://doodle.samistudio.nl.

Real, verified Google Play and Stripe pack fulfillment schedules an owner-only email after the response using Next.js `after`. Recipient: samicodesit@gmail.com. Resend uses the existing AutoLister key, explicitly authorized for reuse by the owner, stored as a production secret in Vercel. Sender: Doodle <updates@autolister.app>, using the existing verified domain. No new dependency, Android release, customer analytics SDK, customer consent screen, or paid email plan was added.

Emails describe ten credits delivered and link to the relevant provider's payment dashboard. They do not assert a payout or a fixed sale price. Customer emails, prompts, account IDs, and raw receipt tokens are not transmitted. Google test purchases, Stripe test-mode purchases, and zero-cost Stripe promotions are excluded.

Redis stores a hash of channel and receipt identifier. A short lock suppresses simultaneous sends; successful sends keep a permanent delivery marker. Resend idempotency keys protect immediate retries when the network response is lost. Failed sends get up to three bounded attempts. Later successful purchase verification can retry an unmarked notification without granting credits again. This is an operational alert, not a durable financial ledger or a guaranteed mail queue. Notification failures cannot reject purchase fulfillment.

Verification: seven notification tests plus 51 existing payment/webhook tests passed in one three-second run. TypeScript and the Vercel production build passed. An explicitly labeled setup email was accepted by Resend and its delivery event was confirmed as `delivered`, email ID `01a0fe58-f35c-73f8-88f1-3aca064bf4e7`. This verifies provider delivery, not that the owner opened it. No second real purchase or Android end-to-end transaction was performed for this update.

Live business evidence: order GPA.3315-4951-8388-52880 was processed on October 2 at 20:15 UTC. Google Play showed EGP 289.99 charged against EGP 339.99 list price and EUR 3.55 estimated revenue. The owner's purchaser screenshot showed Google's 50% offer capped at EGP 50. Google Payments displayed EUR 3.55 earnings and a EUR 1 payout threshold. A bank account was saved, but its payout designation was None; the owner was instructed to choose Primary. Completion of that manual step has not been verified. The Ireland tax-information notice was present. Google's current documentation says Ireland exemption-information status does not currently affect payouts or withholding. The Console also offered enrollment in the 15% service fee tier; enrollment was not performed.

Useful pages:

- Orders: https://play.google.com/console/u/0/developers/5843530199260119810/orders
- Earnings and payout setup: https://play.google.com/console/u/0/developers/5843530199260119810/paymentssettings
- Resend delivery history: https://resend.com/emails
- Payout timing: https://support.google.com/googleplay/android-developer/answer/137997
- Tax residency notice: https://support.google.com/paymentscenter/answer/13401799
