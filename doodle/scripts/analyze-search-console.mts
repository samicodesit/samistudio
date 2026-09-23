import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  analyzeSearchConsoleInputs,
  parseSearchConsoleCsv,
  type SearchConsoleOpportunity,
  type SearchConsoleDimension,
  type SearchConsoleReport,
} from "../src/lib/seo/search-console";

type Format = "json" | "markdown";

type CliOptions = {
  inputs: Array<{ path: string; dimension: SearchConsoleDimension }>;
  output?: string;
  format: Format;
  site: string;
  periodStart: string;
  periodEnd: string;
  observedOn: string;
  minImpressions: number;
};

function usage(): string {
  return `Usage:
  node --import tsx scripts/analyze-search-console.mts \\
    --input ./queries.csv --dimension query \\
    --input ./pages.csv --dimension page \\
    --input ./countries.csv --dimension country \\
    --site https://doodle.samistudio.nl \\
    --period-start 2026-09-01 --period-end 2026-09-30 \\
    --observed-on 2026-10-05 \\
    --output ./docs/seo-reports/2026-09.md \\
    --format markdown

Required flags: one or more --input/--dimension pairs, --period-start, --period-end, --observed-on
Optional flags: --output, --site, --format json|markdown, --min-impressions N`;
}

function readArgument(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return value;
}

function readArguments(args: string[], name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== name) continue;
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
    values.push(value);
    index += 1;
  }
  return values;
}

function parseDimension(value: string): SearchConsoleDimension {
  if (value === "query" || value === "queries") return "query";
  if (value === "page" || value === "pages") return "page";
  if (value === "country" || value === "countries") return "country";
  throw new Error(`--dimension must be query, page, or country; received ${value}`);
}

function parseOptions(args: string[]): CliOptions {
  if (args.includes("--help") || args.includes("-h")) {
    console.log(usage());
    process.exit(0);
  }

  const inputPaths = readArguments(args, "--input");
  const inputDimensions = readArguments(args, "--dimension");
  const periodStart = readArgument(args, "--period-start");
  const periodEnd = readArgument(args, "--period-end");
  const observedOn = readArgument(args, "--observed-on");
  if (inputPaths.length === 0 || inputPaths.length !== inputDimensions.length || !periodStart || !periodEnd || !observedOn) {
    throw new Error(`Missing required flag.\n\n${usage()}`);
  }

  const format = (readArgument(args, "--format") ?? "markdown") as Format;
  if (format !== "json" && format !== "markdown") throw new Error("--format must be json or markdown");

  const minImpressions = Number(readArgument(args, "--min-impressions") ?? "1");
  if (!Number.isInteger(minImpressions) || minImpressions < 1) throw new Error("--min-impressions must be a positive integer");

  return {
    inputs: inputPaths.map((path, index) => ({ path, dimension: parseDimension(inputDimensions[index]) })),
    output: readArgument(args, "--output"),
    format,
    site: readArgument(args, "--site") ?? "https://doodle.samistudio.nl",
    periodStart,
    periodEnd,
    observedOn,
    minImpressions,
  };
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function metricCell(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function opportunityTable(title: string, opportunities: SearchConsoleOpportunity[]): string {
  const lines = [
    `## ${title}`,
    "",
    "| Priority | Key | Impressions | Clicks | CTR | Avg position | Next action |",
    "| --- | --- | ---: | ---: | ---: | ---: | --- |",
  ];

  if (opportunities.length === 0) {
    lines.push("| | No matching rows | 0 | 0 | 0% | | | ");
    return lines.join("\n");
  }

  for (const opportunity of opportunities.slice(0, 50)) {
    lines.push(
      `| ${opportunity.priority} | ${escapeCell(opportunity.key)} | ${opportunity.impressions} | ${opportunity.clicks} | ${(opportunity.ctr * 100).toFixed(1)}% | ${opportunity.position === undefined ? "" : metricCell(opportunity.position)} | ${escapeCell(opportunity.action)} |`,
    );
  }
  return lines.join("\n");
}

function renderMarkdown(options: CliOptions, report: SearchConsoleReport): string {
  return [
    "# Doodle Search Console opportunity report",
    "",
    `- Property: ${options.site}`,
    "- Search type: Google Web Search",
    `- Data window: ${options.periodStart} to ${options.periodEnd}`,
    `- Export or review date: ${options.observedOn}`,
    `- CSV rows analyzed: ${report.rowCount}`,
    `- Input dimensions: ${options.inputs.map((input) => `${input.dimension} (${input.path})`).join(", ")}`,
    `- Minimum impressions per grouped opportunity: ${options.minImpressions}`,
    "",
    "This report contains only rows exposed by the Search Console export. Impressions are appearances in Google Search, not estimated search volume. Priority is a reproducible heuristic based on observed impressions, clicks, CTR, and average position. It is not a ranking guarantee.",
    "",
    opportunityTable("Query opportunities", report.queries),
    "",
    opportunityTable("Page opportunities", report.pages),
    "",
    opportunityTable("Locale opportunities", report.locales),
    "",
    opportunityTable("Country opportunities", report.countries),
    "",
  ].join("\n");
}

async function main(): Promise<void> {
  try {
    const options = parseOptions(process.argv.slice(2));
    const inputs = await Promise.all(
      options.inputs.map(async (input) => ({
        dimension: input.dimension,
        rows: parseSearchConsoleCsv(await readFile(input.path, "utf8")),
      })),
    );
    const report = analyzeSearchConsoleInputs(inputs, { minImpressions: options.minImpressions });
    const document = {
      property: options.site,
      searchType: "web",
      periodStart: options.periodStart,
      periodEnd: options.periodEnd,
      observedOn: options.observedOn,
      minImpressions: options.minImpressions,
      inputs: options.inputs,
      report,
    };
    const output = options.format === "json" ? `${JSON.stringify(document, null, 2)}\n` : renderMarkdown(options, report);

    if (options.output) {
      await mkdir(dirname(options.output), { recursive: true });
      await writeFile(options.output, output, "utf8");
    } else {
      process.stdout.write(output);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

await main();
