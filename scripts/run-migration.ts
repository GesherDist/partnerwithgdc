/**
 * Run Migration Script
 * Usage: npx tsx scripts/run-migration.ts
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Database URL - direct connection for migrations
const DATABASE_URL = "postgresql://postgres.oejfbxycppqxtsspnejr:gesher_distribution@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres";

async function runMigration() {
  console.log('Connecting to database...');

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected successfully!');
    console.log('');

    // Read migration file
    const migrationPath = path.resolve(__dirname, '..', 'supabase', 'migrations', '015_integration_framework.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('Running migration: 015_integration_framework.sql');
    console.log('='.repeat(50));

    // Execute migration
    await client.query(migrationSQL);

    console.log('');
    console.log('Migration completed successfully!');
    console.log('');

    // Verify tables created
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('integrations', 'integration_connections', 'integration_sync_logs')
      ORDER BY table_name;
    `);

    console.log('Tables created:');
    tablesResult.rows.forEach((row: any) => {
      console.log(`  - ${row.table_name}`);
    });

  } catch (error: any) {
    console.error('Migration failed:', error.message);

    if (error.message.includes('already exists')) {
      console.log('');
      console.log('Note: Some objects already exist. Migration may have been partially applied.');
    }

    process.exit(1);
  } finally {
    await client.end();
    console.log('');
    console.log('Database connection closed.');
  }
}

runMigration();
