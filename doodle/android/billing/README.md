# Local Play Billing adapter

This module is forked from GoogleChrome/android-browser-helper's `playbilling` module at tag `billing-1.2.0`, commit `a3638f23537189f82165ff96fb2a60431b03f34c` (28 July 2026).

Upstream source: https://github.com/GoogleChrome/android-browser-helper/tree/billing-1.2.0/playbilling

The source remains under the Apache License 2.0 in `LICENSE`. The local change requires a 64-character lowercase hexadecimal `obfuscatedAccountId` in Payment Request method data and forwards it to `BillingFlowParams`. This binds a Play purchase to the backend-issued account identifier instead of silently dropping it.
