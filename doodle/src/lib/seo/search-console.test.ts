import { describe, expect, it } from "vitest";

import {
  analyzeSearchConsoleInputs,
  analyzeSearchConsoleRows,
  parseSearchConsoleCsv,
  type SearchConsoleInput,
} from "./search-console";

describe("parseSearchConsoleCsv", () => {
  it("parses quoted values, percentage CTR, and optional dimensions", () => {
    const csv = [
      "Top queries,Top pages,Country,Device,Clicks,Impressions,CTR,Position",
      '"doodle, ideeën",https://doodle.samistudio.nl/nl,Netherlands,MOBILE,0,10,0%,22.3',
      "simple doodle,https://doodle.samistudio.nl/doodle-ideas,United States,DESKTOP,2,20,10%,6.5",
    ].join("\n");

    expect(parseSearchConsoleCsv(csv)).toEqual([
      {
        query: "doodle, ideeën",
        page: "https://doodle.samistudio.nl/nl",
        country: "Netherlands",
        device: "MOBILE",
        clicks: 0,
        impressions: 10,
        ctr: 0,
        position: 22.3,
      },
      {
        query: "simple doodle",
        page: "https://doodle.samistudio.nl/doodle-ideas",
        country: "United States",
        device: "DESKTOP",
        clicks: 2,
        impressions: 20,
        ctr: 0.1,
        position: 6.5,
      },
    ]);
  });

  it("rejects a report without the required metrics", () => {
    expect(() => parseSearchConsoleCsv("Query,Clicks\nidea,1")).toThrow(
      /Impressions/i,
    );
  });
});

describe("analyzeSearchConsoleRows", () => {
  it("prioritizes observed query, page, and locale opportunities", () => {
    const rows = parseSearchConsoleCsv(
      [
        "Query,Page,Country,Clicks,Impressions,CTR,Position",
        "doodle ideeën,https://doodle.samistudio.nl/nl,Netherlands,0,10,0%,22.3",
        "simple doodle,https://doodle.samistudio.nl/doodle-ideas,United States,2,20,10%,6.5",
        "birthday doodle,https://doodle.samistudio.nl/doodle-ideas,United States,0,3,0%,41",
      ].join("\n"),
    );

    const report = analyzeSearchConsoleRows(rows);

    expect(report.queries[0]).toMatchObject({
      key: "doodle ideeën",
      impressions: 10,
      clicks: 0,
      priority: "high",
      action: "Improve the matching page and search snippet",
    });
    expect(report.pages[0]).toMatchObject({
      key: "https://doodle.samistudio.nl/doodle-ideas",
      impressions: 23,
      clicks: 2,
    });
    expect(report.locales).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "nl",
          impressions: 10,
          clicks: 0,
        }),
        expect.objectContaining({
          key: "en",
          impressions: 23,
          clicks: 2,
        }),
      ]),
    );
  });

  it("keeps Query, Page, and Country exports in separate metric streams", () => {
    const csv = [
      "Query,Page,Country,Clicks,Impressions,CTR,Position",
      "doodle ideeën,https://doodle.samistudio.nl/nl,Netherlands,0,10,0%,22.3",
    ].join("\n");
    const inputs: SearchConsoleInput[] = [
      { dimension: "query", rows: parseSearchConsoleCsv(csv) },
      { dimension: "page", rows: parseSearchConsoleCsv(csv) },
      { dimension: "country", rows: parseSearchConsoleCsv(csv) },
    ];

    const report = analyzeSearchConsoleInputs(inputs);

    expect(report.queries[0]).toMatchObject({ key: "doodle ideeën", impressions: 10, clicks: 0 });
    expect(report.pages[0]).toMatchObject({ key: "https://doodle.samistudio.nl/nl", impressions: 10, clicks: 0 });
    expect(report.locales[0]).toMatchObject({ key: "nl", impressions: 10, clicks: 0 });
    expect(report.countries[0]).toMatchObject({ key: "Netherlands", impressions: 10, clicks: 0 });
  });

  it("does not treat a URL without a supported locale prefix as a locale claim", () => {
    const report = analyzeSearchConsoleRows([
      {
        page: "https://doodle.samistudio.nl/",
        clicks: 1,
        impressions: 4,
      },
    ]);

    expect(report.locales).toEqual([
      expect.objectContaining({ key: "und", impressions: 4, clicks: 1 }),
    ]);
  });
});
