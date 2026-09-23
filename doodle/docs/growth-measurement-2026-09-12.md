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
