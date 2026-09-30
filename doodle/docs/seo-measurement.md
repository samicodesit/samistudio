# Search demand measurement for Doodle

This workflow records what Google Search Console has actually shown for Doodle. It gives the content work a repeatable signal without guessing monthly keyword volume, scraping private prompts, or treating a referrer string as a search query.

## Current evidence

Source date: **2026-09-23**.

The Search Console screenshot on that date showed **0 Web Search clicks**, **6 indexed pages**, and **23 pages not indexed**. The screenshot did not include the query and impression table, so it is an indexing checkpoint rather than a new demand measurement. Triage the 23 not-indexed URLs in Search Console before expanding the content library. Inspect the exclusion reason, test representative URLs, confirm the intended canonical, and check the sitemap before requesting indexing.

The latest recorded query-level signal is from the **21 August to 5 September 2026** Web Search window, recorded on 7 September: `doodle ideeën` had **10 impressions, 0 clicks, and average position 22.3**. The same record had 10 total impressions and 0 total clicks across the property. This is first-party Search Console data with a very small sample. It is not search volume, a traffic-growth claim, or evidence that Dutch is the winning market.

## What to export from Search Console

Use the verified domain property `sc-domain:doodle.samistudio.nl` and open [Performance > Search results](https://search.google.com/search-console/performance/search-analytics?resource_id=sc-domain%3Adoodle.samistudio.nl). The similarly named URL-prefix property was not verified in the launch check.

For a monthly report, use the last complete calendar month, select **Web** search, and use the **Daily** or **Monthly** time granularity. Do not use the 24-hour view for the monthly baseline because Google marks recent data as preliminary. Export these table views separately:

1. **Queries:** Query, Clicks, Impressions, CTR, Position.
2. **Pages:** Page, Clicks, Impressions, CTR, Position.
3. **Countries:** Country, Clicks, Impressions, CTR, Position.

Keep the same property, search type, date range, and filters for all three exports. Do not filter by an individual query when producing the baseline because Google says query and URL filters can omit anonymized queries and change report totals.

The [Search Console Performance report guide](https://support.google.com/webmasters/answer/7576553?hl=en) defines the metrics, dimensions, date ranges, preliminary data, and export behavior. The [advanced filtering guide](https://support.google.com/webmasters/answer/17011165?hl=en) documents filtering and its data-truncation limitation. A sitemap remains a discovery hint, not an indexing guarantee, as described in Google's [sitemap documentation](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).

## Run the analyzer

From the repository root, run one report with all three exports:

```text
node --import tsx scripts/analyze-search-console.mts \
  --input ./search-console/queries.csv --dimension query \
  --input ./search-console/pages.csv --dimension page \
  --input ./search-console/countries.csv --dimension country \
  --site https://doodle.samistudio.nl \
  --period-start 2026-09-01 \
  --period-end 2026-09-30 \
  --observed-on 2026-10-05 \
  --output ./docs/seo-reports/2026-09.md \
  --format markdown
```

Use the actual last-complete-month dates and the date the export was downloaded. The script accepts Search Console's quoted CSV values, percentage CTR values, and the usual `Query` or `Top queries` and `Page` or `Top pages` headers. It can also write a machine-readable record:

```text
node --import tsx scripts/analyze-search-console.mts \
  --input ./search-console/queries.csv --dimension query \
  --period-start 2026-09-01 --period-end 2026-09-30 \
  --observed-on 2026-10-05 --format json \
  --output ./docs/seo-reports/2026-09.json
```

The report groups and prioritizes only observed rows. A high priority row means the observed impressions are meaningful within this small report and the row has no clicks or is positioned below the first page threshold used by the heuristic. The report never claims a search volume estimate. `en` is assigned to a non-locale path such as `/doodle-ideas`; `und` means the URL is the bare home route or cannot be safely classified. Locale grouping comes from the URL path, not from guessing a user's language from a query.

Each `--input` must have one matching `--dimension`: `query`, `page`, or `country`. The declared dimension controls which report receives that file. Query rows contribute to Query opportunities, Page rows contribute to Page and URL-derived Locale opportunities, and Country rows contribute to Country opportunities. This prevents double-counting when separate exports contain the same metrics plus extra dimension columns. Device exports are outside this report and should be reviewed separately.

## Monthly operating loop

1. First check Page indexing and record indexed versus not-indexed counts, exclusion reasons, and one or two representative inspected URLs.
2. Export the three matching Performance views for the last complete month and save the raw files in a private, access-controlled working directory. Do not commit raw Search Console exports if they contain query strings that should remain private.
3. Run the analyzer and save the Markdown and JSON report with the source date and data window.
4. Review high-priority queries with their matching pages. Improve a page only when the observed query fits the page's real use case. Add a new page when the same intent is repeated across periods and no existing page is a good match.
5. Use Vercel Analytics, already connected on the Pro project, for post-click behavior: landing page views, `Doodle Created`, downloads, shares, and return visits. Search Console measures Google exposure and clicks; Vercel measures what happens after the visit. Keep those measurements separate.
6. Compare the next report with the previous report using observed impressions, clicks, CTR, position, and indexed status. A change in impressions is not proof of total market demand, and a higher average position is not a promise of a stable rank.

## Privacy and evidence rules

- Search Console query rows are aggregate performance data. Keep the CSVs restricted to the project owner and remove them when the reporting need ends.
- Never collect or store free-form Doodle prompts as SEO keywords. They are private user input and are not a substitute for Search Console queries.
- Never infer an exact search phrase from a browser referrer, UTM value, or Vercel Analytics page view.
- Search Console's anonymized-query handling means the query export will not contain every search. Report only what the export exposes.
- Keep the current checkpoint and each monthly report labeled with its source date. Separate observed first-party metrics from self-reported distribution signals and from implementation work.

## Organic discovery triage, 30 September 2026

Read the verified domain property's Page indexing report inline. Its data was last updated 21 September 2026, so this is not a current live-URL verdict. The 23 exclusions comprise 2 alternate pages with proper canonical tags, 1 redirect, 10 Discovered - currently not indexed and 10 Crawled - currently not indexed. The crawled examples include the homepage (last crawled Aug 26), English /doodle-ideas (Sep 3), several localized landing/gallery pages and /terms. Normal canonical/redirect exclusions should not be treated as errors or forced into the index. Prioritize fresh inspection of the homepage and English ideas gallery, then inspect discovery, canonical, useful page content and internal links before requesting a recrawl. This inspection did not establish the cause of Google's indexing choice, perform a fix, request indexing, publish promotional content or claim organic growth.

A scoped source search found no Google Play store destination in src/components or the searched entry files. Live website CTA coverage remains to be checked before changing it. Adding an appropriate Android install link is a potential route from existing website visitors to the published app, not an SEO ranking claim.

## Completed discovery update, 30 September 2026

The subsequent live check confirmed the missing install route. Official localized Play badges and links to three existing drawing guides are now deployed on the homepage and gallery. Both URLs passed Google's live indexability test, and their indexing requests were accepted into the crawl queue. The cached verdict still showed Crawled - currently not indexed; neither indexing nor ranking improvement is claimed. The existing sitemap remains Success. See [the delivery record](organic-discovery-delivery-2026-09-30.md) for scope and verification. Compare future Performance and indexing reports with the launch baseline before attributing growth to these changes.
