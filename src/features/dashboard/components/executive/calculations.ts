/**
 * "How is this calculated?" content for the executive dashboard tables
 * (eye icon next to each table title). Keep in sync with
 * services/executive-erp.service.ts, lib/executive-model.ts and
 * qbo-financials.service.ts.
 */

export type CalcStatus = 'live' | 'partial' | 'pending';

export interface CalcItem {
  kpi: string;
  formula: string;
  source: string;
  status: CalcStatus;
}

const QB_COA = 'QuickBooks, using Settings › QuickBooks › Chart of Accounts';
const ERP_COST = 'ERP cost per tire × tires, per client confirmation (COGS from the ERP): the cost saved on the sales order line by its first fulfillment allocation (order cycle cost of the linked PO for Manufacturer, else of the sales order), else the sales order cycle cost (Products › Cost by Order Cycle), else the purchase cost. The note "Some tires have no ERP cost" means a tire product has no cost entered';
const PY_NOTE = 'PY: "since go-live" — shown as — while the ERP has no prior-year data';

export const CALCULATIONS: Record<string, CalcItem[]> = {
  '1.1': [
    {
      kpi: 'Cash Today',
      formula: '= Σ balances of accounts mapped to "Cash" (bank accounts + undeposited funds) on today’s Balance Sheet',
      source: `${QB_COA} · Balance Sheet`,
      status: 'live',
    },
    { kpi: 'PY', formula: '= the same, on the date one year ago', source: 'QuickBooks Balance Sheet (past date)', status: 'live' },
    {
      kpi: 'Low Cash / High Cash',
      formula: '= lowest / highest projected daily cash balance between today and the Projected Through Date',
      source: 'Pending: needs the cash projection inputs below',
      status: 'pending',
    },
    {
      kpi: 'Projected Cash',
      formula: '= Cash Today + expected inflows (AR, backlog) − expected outflows (AP, supplier payments, OPEX, debt, taxes, CapEx); Through Date = last modeled cash event',
      source: 'Pending: supplier payment schedule, OPEX forecast, debt/tax/CapEx dates are not recorded',
      status: 'pending',
    },
  ],
  '1.2': [
    {
      kpi: 'Current',
      formula: '= today’s Balance Sheet total of accounts mapped to AR / AP / Inventory',
      source: `${QB_COA} · Balance Sheet`,
      status: 'live',
    },
    {
      kpi: 'Weighted Timing',
      formula: '= Σ(open balance × days until due) ÷ Σ open balance; overdue items count as 0 days',
      source: 'QuickBooks open invoices (AR) and open bills (AP)',
      status: 'live',
    },
    {
      kpi: 'T90 Avg / YTD Avg',
      formula: '= average of the month-end balances inside the last 90 days / since Jan 1, plus today',
      source: 'QuickBooks Balance Sheet at each month-end',
      status: 'live',
    },
    { kpi: 'PY', formula: '= balance on the date one year ago', source: 'QuickBooks Balance Sheet (past date)', status: 'live' },
  ],
  '1.3': [
    {
      kpi: 'DSO',
      formula: '= average AR ÷ net credit sales × days in the period',
      source: 'Average AR: QuickBooks month-end balances (PY: prior-year month-ends) · Credit sales: delivered sales orders (all lines, commission-only orders excluded) − credit notes',
      status: 'live',
    },
    {
      kpi: 'DPO',
      formula: '= average AP ÷ credit purchases × days in the period',
      source: 'Average AP: QuickBooks month-end balances · Credit purchases: QuickBooks vendor bills − vendor credits, by transaction date',
      status: 'live',
    },
    {
      kpi: 'DIO',
      formula: '= average inventory at cost ÷ COGS × days in the period',
      source: `Average inventory: QuickBooks month-end balances · COGS: ${ERP_COST}`,
      status: 'live',
    },
    { kpi: 'CCC', formula: '= DIO + DSO − DPO', source: 'Calculated when all three are available', status: 'live' },
  ],
  '1.4': [
    {
      kpi: 'Operating Cash Flow',
      formula: '= "Net cash provided by operating activities" for the period',
      source: 'QuickBooks Statement of Cash Flows',
      status: 'live',
    },
    {
      kpi: 'CapEx',
      formula: '= net cash spent in investing activities for the period (shown as a cost)',
      source: 'QuickBooks Statement of Cash Flows · investing section',
      status: 'live',
    },
    { kpi: 'Free Cash Flow', formula: '= Operating Cash Flow − CapEx', source: 'Calculated', status: 'live' },
  ],
  '2.1': [
    {
      kpi: 'Revenue',
      formula: '= Σ tire line totals of firm sales orders delivered in the period (Ankur 3.1: recognized when fulfilled), net of line discounts, excl. tax − credit notes (issued/applied) in the period',
      source: 'ERP sales orders · delivery date = actual delivery date, else delivered shipment arrival, else order date when status is Delivered · tires = products of type Inventory · commission-only orders excluded',
      status: 'live',
    },
    { kpi: 'COGS', formula: '= ERP cost of the same delivered tires (tires × product cost)', source: ERP_COST, status: 'live' },
    { kpi: 'Gross Profit', formula: '= Revenue − COGS; % = Gross Profit ÷ Revenue', source: 'Calculated', status: 'live' },
    {
      kpi: 'OPEX',
      formula: '= Profit & Loss total of accounts mapped to OPEX for the period; % = OPEX ÷ Revenue',
      source: `${QB_COA} · Profit and Loss`,
      status: 'live',
    },
    { kpi: 'Operating Profit', formula: '= Gross Profit − OPEX; % = Operating Profit ÷ Revenue', source: 'ERP gross profit − QuickBooks OPEX', status: 'live' },
    {
      kpi: 'Columns',
      formula: 'MTD = 1st of month → today · T90 = last 90 days · YTD = Jan 1 → today · PY = Jan 1 → same date last year',
      source: `Dates in America/New_York · ${PY_NOTE}`,
      status: 'live',
    },
  ],
  '2.1b': [
    {
      kpi: 'Commission Billed',
      formula: '= Σ line totals of commission invoices to Galileo (not draft/cancelled) dated in the period',
      source: 'ERP commission invoices · kept out of Revenue, COGS and Gross Profit (Ankur, Sep 8 / Sep 25)',
      status: 'live',
    },
    {
      kpi: 'Not Billed Yet',
      formula: '= Σ commission on commission-only sales orders (tires allocated Manufacturer Direct × rate per tire) not yet on a commission invoice',
      source: 'ERP sales orders',
      status: 'live',
    },
  ],
  '2.2': [
    { kpi: 'Tires Sold', formula: '= Σ quantity of the same delivered tire lines used for Revenue', source: 'ERP sales orders', status: 'live' },
    { kpi: 'Revenue / Tire', formula: '= Revenue ÷ Tires Sold', source: 'Calculated', status: 'live' },
    { kpi: 'OPEX / Tire', formula: '= OPEX ÷ Tires Sold', source: 'QuickBooks OPEX ÷ ERP tires', status: 'live' },
    { kpi: 'COGS / GP / OP per Tire', formula: '= each line ÷ Tires Sold', source: 'Calculated', status: 'live' },
  ],
  '2.3': [
    {
      kpi: 'OPEX / Month – Current Month Est.',
      formula: '= actual OPEX month to date + forecast for the rest of the month',
      source: 'Pending: forecast method to be agreed (the note shows the MTD actual)',
      status: 'pending',
    },
    { kpi: 'OPEX / Month – T90 Avg', formula: '= OPEX of the last 90 days ÷ 3', source: 'QuickBooks Profit and Loss (OPEX accounts)', status: 'live' },
    { kpi: 'OPEX / Month – PY', formula: '= OPEX of the same 90 days last year ÷ 3', source: 'QuickBooks Profit and Loss', status: 'live' },
    { kpi: 'Annualized OPEX', formula: '= OPEX per month × 12', source: 'Calculated', status: 'live' },
  ],
  '3.1': [
    {
      kpi: 'Backlog Tires',
      formula: '= Σ tires on firm sales orders still confirmed or processing and not delivered yet (Ankur 4.1: firm ordered − fulfilled)',
      source: 'ERP sales orders · no quotes or pipeline · commission-only orders excluded (Galileo invoices the customer; see Commission Revenue)',
      status: 'live',
    },
    { kpi: 'Backlog Revenue', formula: '= remaining tires × net unit price of the sales order line', source: 'ERP sales orders', status: 'live' },
    { kpi: 'Revenue / Tire', formula: '= Backlog Revenue ÷ Backlog Tires', source: 'Calculated', status: 'live' },
    { kpi: 'Backlog GP, GP / Tire, GP %', formula: '= Backlog Revenue − ERP cost of the remaining tires', source: ERP_COST, status: 'live' },
    {
      kpi: 'T90 Avg / YTD Avg / PY',
      formula: '= average of the daily backlog values in the last 90 days / since Jan 1; PY = the value one year ago',
      source: 'Recorded daily from Oct 20, 2026 (the note shows how many days are recorded so far); PY after one year',
      status: 'partial',
    },
  ],
  '4.1': [
    { kpi: 'Order Cycle', formula: '= purchase order "order series" (GDC 0, 1, 2, 3)', source: 'ERP purchase orders', status: 'live' },
    { kpi: 'Tires Ordered', formula: '= Σ tire quantities on the cycle’s purchase orders (not draft/cancelled)', source: 'ERP purchase orders', status: 'live' },
    {
      kpi: 'Containers',
      formula: '= number of distinct container numbers on the shipments of the cycle’s purchase orders',
      source: 'ERP shipments (container numbers entered by Jenny or the supplier); "—" until one is entered',
      status: 'live',
    },
    {
      kpi: 'Arrival Window',
      formula: '= earliest – latest ETA of the cycle’s shipments (tracking ETA, else confirmed ETA, else ETA to port, else estimated arrival); a PO without a shipment ETA uses its confirmed ETA, else its expected delivery date',
      source: 'ERP shipments / CMA tracking',
      status: 'live',
    },
    { kpi: 'Weeks Left', formula: '= (window start − today) ÷ 7; 0 once the window has started', source: 'Calculated', status: 'live' },
    {
      kpi: 'Sold / Unsold / Forward Commit %',
      formula: 'Sold = tires on sales orders (not draft/cancelled) of the same cycle · Unsold = Ordered − Sold · Commit % = Sold ÷ Ordered',
      source: 'ERP sales orders',
      status: 'live',
    },
    {
      kpi: 'Velocity',
      formula: 'Actual = tires on the cycle’s sales orders dated in the last 4 weeks ÷ 4 · Required = Unsold ÷ Weeks Left · Gap = Actual − Required',
      source: 'ERP sales orders',
      status: 'live',
    },
    { kpi: 'Projected Uncommitted at Arrival', formula: '= max(0, Unsold − Actual Velocity × Weeks Left); = Unsold once the arrival window has started', source: 'Calculated', status: 'live' },
  ],
  '4.2': [
    {
      kpi: 'Inventory at Cost',
      formula: '= Balance Sheet total of accounts mapped to Inventory (current, month-end averages, PY)',
      source: `${QB_COA} · Balance Sheet`,
      status: 'live',
    },
    { kpi: 'Tires On Hand', formula: '= Σ on hand of tire products', source: 'ERP inventory', status: 'live' },
    { kpi: 'Cost / Tire', formula: '= Inventory at Cost ÷ Tires On Hand', source: 'QuickBooks ÷ ERP', status: 'live' },
    { kpi: 'Uncommitted Inventory', formula: '= max(0, tires on hand − tires allocated to orders)', source: 'ERP inventory', status: 'live' },
    {
      kpi: 'Uncommitted Months of Supply',
      formula: '= Uncommitted ÷ average monthly delivered tires over the last 3 completed months',
      source: 'ERP inventory + sales orders',
      status: 'live',
    },
    {
      kpi: 'Unit averages / PY',
      formula: '= average of the daily values (tires on hand, cost per tire, uncommitted, months of supply) in the last 90 days / since Jan 1; PY = the value one year ago',
      source: 'Recorded daily from Oct 20, 2026 (the note shows how many days are recorded so far); PY after one year',
      status: 'partial',
    },
  ],
};
