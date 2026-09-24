/**
 * Check Integrations Debug Script
 * Usage: npx tsx scripts/check-integrations.ts
 */

import { Client } from 'pg';

// Database URL - direct connection
const DATABASE_URL = "postgresql://postgres.oejfbxycppqxtsspnejr:gesher_distribution@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres";

async function checkIntegrations() {
  console.log('Connecting to database...');

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected successfully!\n');

    // Check integrations table
    console.log('='.repeat(50));
    console.log('INTEGRATIONS TABLE:');
    console.log('='.repeat(50));

    const integrationsResult = await client.query(`
      SELECT id, provider, type, name, status
      FROM integrations
      ORDER BY name;
    `);

    if (integrationsResult.rows.length === 0) {
      console.log('❌ No integrations found! Seed data may not have been inserted.');
    } else {
      console.log('Found integrations:');
      integrationsResult.rows.forEach((row: any) => {
        console.log(`  - ${row.provider} (${row.type}): ${row.name} [${row.status}]`);
        console.log(`    ID: ${row.id}`);
      });
    }

    // Check integration_connections table
    console.log('\n' + '='.repeat(50));
    console.log('INTEGRATION CONNECTIONS TABLE:');
    console.log('='.repeat(50));

    const connectionsResult = await client.query(`
      SELECT
        ic.id,
        ic.integration_id,
        i.provider,
        ic.external_account_id,
        ic.external_account_name,
        ic.status,
        ic.environment,
        ic.connected_at,
        ic.deleted_at
      FROM integration_connections ic
      LEFT JOIN integrations i ON ic.integration_id = i.id
      ORDER BY ic.created_at DESC;
    `);

    if (connectionsResult.rows.length === 0) {
      console.log('ℹ️  No connections found (this is normal if not connected yet)');
    } else {
      console.log('Found connections:');
      connectionsResult.rows.forEach((row: any) => {
        const deleted = row.deleted_at ? ' [DELETED]' : '';
        console.log(`  - ${row.provider}: ${row.external_account_name || 'N/A'}${deleted}`);
        console.log(`    ID: ${row.id}`);
        console.log(`    Status: ${row.status}`);
        console.log(`    Environment: ${row.environment}`);
        console.log(`    External Account ID: ${row.external_account_id || 'N/A'}`);
        console.log(`    Connected At: ${row.connected_at || 'N/A'}`);
      });
    }

    // Check environment variables
    console.log('\n' + '='.repeat(50));
    console.log('ENVIRONMENT VARIABLES CHECK:');
    console.log('='.repeat(50));

    const envVars = [
      'NEXT_QUICKBOOKS_CLIENT_ID',
      'NEXT_QUICKBOOKS_SECRET_ID',
      'NEXT_QUICKBOOKS_REDIRECT_URI',
      'NEXT_QUICKBOOKS_ENVIRONMENT',
      'QBO_ENCRYPTION_KEY',
      'INTEGRATION_ENCRYPTION_KEY',
    ];

    envVars.forEach(varName => {
      const value = process.env[varName];
      if (value) {
        if (varName.includes('KEY') || varName.includes('SECRET')) {
          console.log(`  ✅ ${varName}: [SET - ${value.length} chars]`);
        } else {
          console.log(`  ✅ ${varName}: ${value}`);
        }
      } else {
        console.log(`  ❌ ${varName}: NOT SET`);
      }
    });

  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
    console.log('\nDatabase connection closed.');
  }
}

checkIntegrations();
