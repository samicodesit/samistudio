# Doodle growth measurement, September 12, 2026

## Vercel production analytics recovery

Source: Vercel Analytics for the verified project `doodle` in Ahmed Sami's projects, hostname `doodle.samistudio.nl`, environment `Production`. Read from a fresh dashboard view on September 12, 2026. No paid upgrade, API access, account change, or publishing action was used.

The current-day window shown by the dashboard is **September 11, 2026 to September 12, 2026**:

- Visitors: **5**
- Page views: **7**
- Bounce rate: **80%**
- Pages: `/` 3 visitors, `/contact` 1, `/privacy` 1
- Referrers shown: `google.com` 2. Product Hunt and YouTube were not shown in this window.
- Events: `Doodle Created` 1 visitor and 1 total. No Share or Download event was shown.
- Countries: United States 80%, Netherlands 20%
- Devices: Desktop 100%

The comparison window shown immediately before selecting the current-day view was **September 5, 2026 at 1:00pm to September 12, 2026 at 1:59pm** (`Last 7 Days`):

- Visitors: **73**
- Page views: **168**
- Bounce rate: **60%**
- Pages: `/` 58, `/privacy` 11, `/delete-account` 6, `/contact` 3, `/ar` 2, `/doodle-ideas` 2, `/nl` 2 visitors
- Referrers shown: LinkedIn 4, Google 3, `nl.samistudio.doodle` 3, Reddit 3, `l.instagram.com` 2, `t.co` 2, Facebook 1
- Events: `Doodle Created` 18 visitors and 28 total, `Doodle Shared` 4 and 4, `Doodle Downloaded` 3 and 6, `Doodle Card Download Requested` 1 and 1, `Doodle Card Opened` 1 and 2
- Countries: Netherlands 47%, United States 44%, United Kingdom 3%, Spain 1%, Ireland 1%
- Devices: Desktop 58%, Mobile 42%

These are aggregate first-party dashboard counts. They cannot distinguish owner or agent QA from external visitors and cannot join an event to a specific referrer. The referrer list therefore does not establish that any listed social or community source was a Doodle campaign. The current free dashboard does not provide source-level UTM attribution in this view.

## Decision signal

The clearest current bottleneck is exposure to the site: the current-day dashboard shows only five visitors, with one creation event and no demonstrated Product Hunt or YouTube referral. The data does not establish zero referrals, only that those sources were not displayed in the current-day referrer report.

The next measurement step is to use one approved external route with a recorded publication time, then compare a fresh 24-hour Vercel window against `Doodle Created`, Share, and Download events. Until that exists, the seven-day event totals remain useful product activity signals but are not evidence of campaign conversion.

## Public-launch baseline, 30 September 2026

Read live dashboards inline after Production build 5 published at 14:18 Europe/Amsterdam. The current public launch is not represented as acquired customers from older testing activity.

- Play Grow overview: https://play.google.com/console/u/0/developers/5843530199260119810/app/4973301025063263916/grow-overview
- Play Store listings: https://play.google.com/console/u/0/developers/5843530199260119810/app/4973301025063263916/store-listings
- Vercel Production website analytics: https://vercel.com/ahmed-samis-projects-e6ef0336/doodle/analytics
- Verified Search Console property is the domain property sc-domain:doodle.samistudio.nl. Performance: https://search.google.com/search-console/performance/search-analytics?resource_id=sc-domain%3Adoodle.samistudio.nl

Vercel's Last 7 Days window, Sep 23 at 14:00 to Sep 30 at 14:59 as displayed, showed 56 visitors, 154 page views and 54% bounce rate. Visible referrers were t.co 6 visitors, chatgpt.com 1, checkout.stripe.com 1, linkedin.com 1. Doodle Created showed 9 visitors / 10 total events; Doodle Downloaded 1 / 1. These web aggregates include unexcluded owner and agent QA, have daily visitor-session semantics, and are not native-app generation telemetry, unique customers or campaign conversion evidence.

Play Store listings displayed Aug 25 to Sep 21, 2026: 8 visitors and 3 unique user install clicks, approximately 38% CTR. This is a pre-launch window. Install clicks are not completed installations, and closed/internal testing activity must not be called new Production discovery.

Search Console's selected 3-month Web report chart covered Aug 21 to Sep 27, 2026 and showed 22 impressions, 0 clicks, 0% CTR and average position 13.7. The visible query table exposed doodles para copiar, doodle ideeën, and doodle notes ai, each with one impression and zero clicks. Small anonymized aggregate rows do not expose all queries or establish a winning market. Indexing overview remained 6 indexed / 23 not indexed pages; exclusion reasons were not triaged in this check.

Recommendation: preserve the accurately labeled current feature graphic for launch, monitor discovery and installation separately, and compare post-launch reporting from Sep 30 onward once data is available. Use Play for native discovery/install/activity/revenue, Search Console for Google web discovery, and Vercel for website behavior. No monitoring automation, new analytics SDK, artwork replacement, ad spend or publishing change was created by this inspection.

## Subsequent organic discovery implementation, 30 September 2026

Deployed the official localized Play install badge and links to the existing card, lunchbox note and journal guides. Saved the relevant Art & design Play tag; retained the category, screenshot sequence and current feature graphic. Google accepted homepage and gallery indexing requests after successful live tests. These are completed implementation actions, not observed traffic, installs or revenue increases. No follow-up growth measurements are available yet. [Delivery and verification record](organic-discovery-delivery-2026-09-30.md).
