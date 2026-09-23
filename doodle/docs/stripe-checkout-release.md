# Stripe web checkout release gate

Paid web checkout is fail closed until its release configuration is explicit.
This keeps an unknown tax setup from silently becoming a live payment path.

## Configuration

The following variables are server-only and belong in the deployment environment.
They are intentionally absent from the default local configuration except for
safe defaults in `.env.example`.

| Variable | Required value | Effect |
| --- | --- | --- |
| `STRIPE_CHECKOUT_ENABLED` | `true` | Allows Doodle to request a hosted Stripe Checkout Session. Any other value disables paid checkout. |
| `STRIPE_CHECKOUT_TAX_MODE` | `disabled` or `automatic` | Selects the explicit tax mode. Missing or invalid values disable paid checkout. |
| `STRIPE_TAX_REGISTRATION_CONFIRMED` | `true` when tax mode is `automatic` | Records the release check that the active Stripe Tax registration and account setup were verified. It is required before Automatic Tax can be sent to Stripe. |

The `disabled` tax mode is an explicit owner or advisor decision. It does not
claim that tax collection is unnecessary, and it should not be selected by
omitting the tax mode.

The `automatic` tax mode requires all of the following to be checked in the
live Stripe account before the environment value is changed:

- the applicable active tax registration is present in Stripe Tax;
- the business location and Tax settings are complete;
- the Doodle Product has the intended digital-service tax code;
- the Doodle Price has the intended tax behavior, including whether the €4.99
  customer total is inclusive; and
- a controlled Checkout preview shows the expected address collection and
  total.

Stripe Tax setup and registration decisions belong in the Stripe Dashboard and
with the owner’s tax advisor. An environment flag is a release assertion, not
independent evidence of registration.

## Runtime behavior

When the configuration is missing or invalid, `/api/checkout` keeps its generic
`503 billing_unavailable` response and does not call Stripe. Existing
confirmation and webhook handlers can still fulfill already-created, valid
sessions, which prevents disabling new checkout from breaking prior purchases.

The Android Play purchase path is separate and does not use these web Stripe
flags.

## Release checklist

1. Keep `STRIPE_CHECKOUT_ENABLED` unset or `false` while the tax mode is
   unknown.
2. Choose `disabled` only after recording the owner or advisor decision that
   applies to this release.
3. Choose `automatic` only after the live Stripe Tax checks above are complete,
   then set `STRIPE_TAX_REGISTRATION_CONFIRMED=true` in the same release.
4. Run the billing tests, typecheck, lint, production build, and relevant
   browser checks before deployment.
5. Review the deployed environment and Checkout behavior after deployment.

Stripe references:

- [Register for sales tax, VAT, and GST](https://docs.stripe.com/tax/registering.md)
- [Tax Registrations API](https://docs.stripe.com/api/tax/registrations)
- [Tax settings](https://docs.stripe.com/api/tax/settings/object)
- [Price tax behavior](https://docs.stripe.com/api/prices/object)
