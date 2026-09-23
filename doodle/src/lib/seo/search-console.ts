export type SearchConsoleRow = {
  query?: string;
  page?: string;
  country?: string;
  device?: string;
  date?: string;
  clicks: number;
  impressions: number;
  ctr?: number;
  position?: number;
};

export type OpportunityPriority = "high" | "medium" | "low";

export type SearchConsoleOpportunity = {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position?: number;
  priority: OpportunityPriority;
  action: string;
};

export type SearchConsoleDimension = "query" | "page" | "country";

export type SearchConsoleInput = {
  dimension: SearchConsoleDimension;
  rows: SearchConsoleRow[];
};

export type SearchConsoleReport = {
  rowCount: number;
  queries: SearchConsoleOpportunity[];
  pages: SearchConsoleOpportunity[];
  locales: SearchConsoleOpportunity[];
  countries: SearchConsoleOpportunity[];
};

export type SearchConsoleAnalysisOptions = {
  minImpressions?: number;
};

const HEADER_ALIASES = {
  query: ["query", "queries", "top query", "top queries"],
  page: ["page", "pages", "top page", "top pages", "url"],
  country: ["country", "countries"],
  device: ["device", "devices"],
  date: ["date", "dates"],
  clicks: ["clicks", "click"],
  impressions: ["impressions", "impression"],
  ctr: ["ctr"],
  position: ["position", "average position"],
} as const;

type ColumnName = keyof typeof HEADER_ALIASES;

function normalizeHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function splitCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (character === '"') {
      if (quoted && input[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (!quoted && character === ",") {
      row.push(value);
      value = "";
      continue;
    }

    if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(value);
      value = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      continue;
    }

    value += character;
  }

  if (quoted) throw new Error("The Search Console CSV contains an unclosed quote");
  if (value !== "" || row.length > 0) {
    row.push(value);
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  }

  return rows;
}

function findColumn(headers: string[], name: ColumnName): number | undefined {
  const aliases = HEADER_ALIASES[name];
  const index = headers.findIndex((header) => aliases.includes(header as never));
  return index === -1 ? undefined : index;
}

function parseNumber(value: string | undefined, field: string): number | undefined {
  if (value === undefined || value.trim() === "" || value.trim() === "-") return undefined;
  const parsed = Number(value.trim().replace(/,/g, ""));
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${field} value: ${value}`);
  return parsed;
}

function parseCtr(value: string | undefined, clicks: number, impressions: number): number {
  if (value === undefined || value.trim() === "" || value.trim() === "-") {
    return impressions > 0 ? clicks / impressions : 0;
  }
  const trimmed = value.trim();
  const parsed = parseNumber(trimmed.replace(/%$/, ""), "CTR") ?? 0;
  return trimmed.endsWith("%") ? parsed / 100 : parsed > 1 ? parsed / 100 : parsed;
}

function cell(cells: string[], index: number | undefined): string | undefined {
  if (index === undefined) return undefined;
  const value = cells[index]?.trim();
  return value ? value : undefined;
}

export function parseSearchConsoleCsv(input: string): SearchConsoleRow[] {
  const rows = splitCsv(input);
  if (rows.length === 0) return [];

  const headers = rows[0].map(normalizeHeader);
  const clicksColumn = findColumn(headers, "clicks");
  const impressionsColumn = findColumn(headers, "impressions");
  if (clicksColumn === undefined) throw new Error("Search Console CSV is missing a Clicks column");
  if (impressionsColumn === undefined) throw new Error("Search Console CSV is missing an Impressions column");

  const queryColumn = findColumn(headers, "query");
  const pageColumn = findColumn(headers, "page");
  const countryColumn = findColumn(headers, "country");
  const deviceColumn = findColumn(headers, "device");
  const dateColumn = findColumn(headers, "date");
  const ctrColumn = findColumn(headers, "ctr");
  const positionColumn = findColumn(headers, "position");

  return rows.slice(1).map((cells, rowIndex) => {
    const clicks = parseNumber(cell(cells, clicksColumn), "Clicks");
    const impressions = parseNumber(cell(cells, impressionsColumn), "Impressions");
    if (clicks === undefined || impressions === undefined) {
      throw new Error(`Search Console row ${rowIndex + 2} is missing Clicks or Impressions`);
    }
    if (clicks < 0 || impressions < 0) {
      throw new Error(`Search Console row ${rowIndex + 2} has a negative metric`);
    }

    return {
      query: cell(cells, queryColumn),
      page: cell(cells, pageColumn),
      country: cell(cells, countryColumn),
      device: cell(cells, deviceColumn),
      date: cell(cells, dateColumn),
      clicks,
      impressions,
      ctr: parseCtr(cell(cells, ctrColumn), clicks, impressions),
      position: parseNumber(cell(cells, positionColumn), "Position"),
    };
  });
}

function localeFromPage(page: string): string {
  try {
    const segments = new URL(page).pathname.split("/").filter(Boolean);
    const firstSegment = segments[0]?.toLowerCase();
    if (!firstSegment) return "und";
    if (["en", "nl", "de", "fr", "es", "it", "ja", "ko", "ar", "pt-br"].includes(firstSegment)) {
      return firstSegment;
    }
    return "en";
  } catch {
    return "und";
  }
}

function classifyOpportunity(
  opportunity: Pick<SearchConsoleOpportunity, "clicks" | "impressions" | "ctr" | "position">,
): OpportunityPriority {
  if (
    opportunity.impressions >= 10 &&
    (opportunity.clicks === 0 || (opportunity.position !== undefined && opportunity.position > 10))
  ) {
    return "high";
  }
  if (
    opportunity.impressions >= 3 &&
    (opportunity.clicks === 0 || (opportunity.position !== undefined && opportunity.position > 10))
  ) {
    return "medium";
  }
  return "low";
}

function actionForOpportunity(opportunity: Pick<SearchConsoleOpportunity, "clicks" | "position">): string {
  if (opportunity.clicks === 0) return "Improve the matching page and search snippet";
  if (opportunity.position !== undefined && opportunity.position > 10) return "Strengthen relevance and internal links";
  return "Refresh the page and monitor the next period";
}

function aggregate(
  rows: SearchConsoleRow[],
  keyForRow: (row: SearchConsoleRow) => string | undefined,
  minImpressions: number,
): SearchConsoleOpportunity[] {
  const grouped = new Map<string, { clicks: number; impressions: number; positionWeight: number; positionImpressions: number }>();

  for (const row of rows) {
    const key = keyForRow(row);
    if (!key) continue;
    const current = grouped.get(key) ?? { clicks: 0, impressions: 0, positionWeight: 0, positionImpressions: 0 };
    current.clicks += row.clicks;
    current.impressions += row.impressions;
    if (row.position !== undefined) {
      current.positionWeight += row.position * row.impressions;
      current.positionImpressions += row.impressions;
    }
    grouped.set(key, current);
  }

  return [...grouped.entries()]
    .map(([key, value]) => {
      const ctr = value.impressions > 0 ? value.clicks / value.impressions : 0;
      const position = value.positionImpressions > 0 ? value.positionWeight / value.positionImpressions : undefined;
      const priority = classifyOpportunity({ ...value, ctr, position });
      return {
        key,
        clicks: value.clicks,
        impressions: value.impressions,
        ctr,
        ...(position === undefined ? {} : { position: Number(position.toFixed(2)) }),
        priority,
        action: actionForOpportunity({ clicks: value.clicks, position }),
      };
    })
    .filter((opportunity) => opportunity.impressions >= minImpressions)
    .sort((left, right) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 } as const;
      return priorityOrder[left.priority] - priorityOrder[right.priority] || right.impressions - left.impressions || right.clicks - left.clicks || left.key.localeCompare(right.key);
    });
}

function validateMinImpressions(options: SearchConsoleAnalysisOptions): number {
  const minImpressions = options.minImpressions ?? 1;
  if (!Number.isInteger(minImpressions) || minImpressions < 1) {
    throw new Error("minImpressions must be a positive integer");
  }
  return minImpressions;
}

export function analyzeSearchConsoleInputs(
  inputs: SearchConsoleInput[],
  options: SearchConsoleAnalysisOptions = {},
): SearchConsoleReport {
  const minImpressions = validateMinImpressions(options);
  const queryRows = inputs.filter((input) => input.dimension === "query").flatMap((input) => input.rows);
  const pageRows = inputs.filter((input) => input.dimension === "page").flatMap((input) => input.rows);
  const countryRows = inputs.filter((input) => input.dimension === "country").flatMap((input) => input.rows);

  return {
    rowCount: inputs.reduce((count, input) => count + input.rows.length, 0),
    queries: aggregate(queryRows, (row) => row.query, minImpressions),
    pages: aggregate(pageRows, (row) => row.page, minImpressions),
    locales: aggregate(pageRows, (row) => (row.page ? localeFromPage(row.page) : undefined), minImpressions),
    countries: aggregate(countryRows, (row) => row.country, minImpressions),
  };
}

export function analyzeSearchConsoleRows(
  rows: SearchConsoleRow[],
  options: SearchConsoleAnalysisOptions = {},
): SearchConsoleReport {
  const minImpressions = validateMinImpressions(options);

  return {
    rowCount: rows.length,
    queries: aggregate(rows, (row) => row.query, minImpressions),
    pages: aggregate(rows, (row) => row.page, minImpressions),
    locales: aggregate(rows, (row) => (row.page ? localeFromPage(row.page) : undefined), minImpressions),
    countries: aggregate(rows, (row) => row.country, minImpressions),
  };
}
