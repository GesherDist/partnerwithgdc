/**
 * Overview drill-down exports (download button next to each eye icon).
 * Client-safe: shared by the buttons and services/overview-drilldown.service.
 */

export const OVERVIEW_DRILLDOWNS = [
  'revenue-period',
  'revenue-ytd',
  'units-period',
  'units-ytd',
  'blended-margin',
  'open-orders',
  'commission-expected',
  'commission-actual',
  'revenue-trend',
  'units-by-sku',
  'channel',
  'margin-analysis',
] as const;

export type OverviewDrillDown = (typeof OVERVIEW_DRILLDOWNS)[number];

/** KPI card id (getDashboardStats / DashboardContent) → drill-down */
export const STAT_DRILLDOWN: Record<string, OverviewDrillDown> = {
  'revenue-mtd': 'revenue-period',
  'revenue-ytd': 'revenue-ytd',
  'units-sold': 'units-period',
  'units-sold-ytd': 'units-ytd',
  'blended-margin': 'blended-margin',
  'open-orders': 'open-orders',
  'commission-expected-ytd': 'commission-expected',
  'commission-actual-ytd': 'commission-actual',
};

/** Executive tabs: one export per table (download button next to its eye icon) */
export const TABLE_DRILLDOWNS = [
  'table-1.1',
  'table-1.2',
  'table-1.3',
  'table-1.4',
  'table-2.1',
  'table-2.1b',
  'table-2.3',
  'table-3.1',
  'table-4.1',
  'table-4.2',
] as const;

export type TableDrillDown = (typeof TABLE_DRILLDOWNS)[number];

/** Executive table id (calculations.ts) → drill-down */
export const TABLE_DRILLDOWN: Record<string, TableDrillDown> = {
  '1.1': 'table-1.1',
  '1.2': 'table-1.2',
  '1.3': 'table-1.3',
  '1.4': 'table-1.4',
  '2.1': 'table-2.1',
  '2.1b': 'table-2.1b',
  '2.3': 'table-2.3',
  '3.1': 'table-3.1',
  '4.1': 'table-4.1',
  '4.2': 'table-4.2',
};

export interface CsvExport {
  filename: string;
  csv: string;
}

export interface CsvSection {
  title: string | null;
  columns: string[];
  rows: string[][];
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      cells.push(cell);
      cell = '';
    } else {
      cell += ch;
    }
  }
  cells.push(cell);
  return cells;
}

/**
 * A drill-down CSV as tables for the modal view. Sections are separated by a
 * blank line; a one-cell first row is the section title, the next row its header.
 */
export function parseCsvSections(csv: string): CsvSection[] {
  return csv
    .split(/\r?\n\r?\n/)
    .map((block) => block.split(/\r?\n/).filter((line) => line !== '').map(parseCsvLine))
    .filter((lines) => lines.length > 0)
    .map((lines) => {
      const hasTitle = lines.length > 1 && lines[0]!.filter((c) => c !== '').length === 1 && lines[0]!.length === 1;
      const [header = [], ...rows] = hasTitle ? lines.slice(1) : lines;
      return { title: hasTitle ? lines[0]![0]! : null, columns: header, rows };
    });
}
