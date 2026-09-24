import { Client } from 'pg';

const DATABASE_URL = "postgresql://postgres.oejfbxycppqxtsspnejr:gesher_distribution@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres";

async function run() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  // Get table structure
  const cols = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'customers'
    ORDER BY ordinal_position
  `);
  console.log('=== CUSTOMERS TABLE STRUCTURE ===');
  cols.rows.forEach((r: any) => console.log(`${r.column_name} (${r.data_type})`));

  // Get count
  const count = await client.query('SELECT COUNT(*) FROM customers WHERE deleted_at IS NULL');
  console.log('');
  console.log(`=== CUSTOMER COUNT: ${count.rows[0].count} ===`);

  // Get sample data
  if (parseInt(count.rows[0].count) > 0) {
    const sample = await client.query('SELECT id, name, email FROM customers WHERE deleted_at IS NULL LIMIT 5');
    console.log('');
    console.log('=== SAMPLE DATA ===');
    sample.rows.forEach((r: any) => console.log(`${r.id} | ${r.name} | ${r.email}`));
  }

  await client.end();
}

run().catch(e => console.log('Error:', e.message));
