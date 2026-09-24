/**
 * Script to fetch all permissions from database
 * Run with: npx tsx --env-file=.env.local scripts/get-permissions.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getPermissions() {
  const { data, error } = await supabase
    .from('permissions')
    .select('name, description, group_name, parent_id')
    .order('group_name')
    .order('sort_order');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n=== ALL PERMISSIONS FROM DATABASE ===\n');

  // Group by group_name
  const grouped: Record<string, typeof data> = {};
  for (const perm of data) {
    const group = perm.group_name || 'Other';
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(perm);
  }

  for (const [group, perms] of Object.entries(grouped)) {
    console.log(`\n## ${group}`);
    for (const p of perms) {
      const indent = p.parent_id ? '  - ' : '- ';
      console.log(`${indent}${p.name}`);
    }
  }

  console.log('\n\n=== SUMMARY ===');
  console.log(`Total permissions: ${data.length}`);
  console.log(`Groups: ${Object.keys(grouped).join(', ')}`);
}

getPermissions();
