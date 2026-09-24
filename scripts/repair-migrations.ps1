# Repair Supabase Migrations
# This script marks all existing migrations as "applied" in the remote database

Write-Host "Marking existing migrations as applied..." -ForegroundColor Cyan

$migrations = @(
    "001_initial_schema",
    "002_auth_tables",
    "003_rbac_tables",
    "004_audit_tables",
    "005_phase1_enums",
    "006_products_table",
    "007_locations_table",
    "008_customers_table",
    "009_customer_contacts_table",
    "010_customer_documents_table",
    "011_price_matrix_table",
    "012_sales_orders_tables",
    "014_add_tax_exempt_expiry",
    "015_integration_framework",
    "015_quotes_tables",
    "016_customer_documents",
    "016_add_quote_link_to_sales_orders",
    "017_customer_documents_storage",
    "017_vendors_table",
    "018_purchase_orders_tables",
    "019_shipments_tables",
    "020_invoices_tables"
)

foreach ($migration in $migrations) {
    Write-Host "  Marking $migration as applied..." -ForegroundColor Yellow
    npx supabase migration repair --status applied $migration 2>$null
}

Write-Host ""
Write-Host "Done! Now running db push for new migrations..." -ForegroundColor Cyan
Write-Host ""

npx supabase db push

Write-Host ""
Write-Host "Migration complete!" -ForegroundColor Green
