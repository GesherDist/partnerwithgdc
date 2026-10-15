// Run with: node --env-file=.env scripts/check-permissions.mjs
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data, error } = await supabase
  .from('permissions')
  .select('name, description, group_name, permission_type')
  .order('group_name')
  .order('sort_order');

if (error) {
  console.log('Error:', error.message);
  process.exit(1);
}

console.log('='.repeat(60));
console.log('TOTAL PERMISSIONS IN DATABASE:', data.length);
console.log('='.repeat(60));
console.log('');

// Group by group_name
const grouped = {};
data.forEach(p => {
  const group = p.group_name || 'Ungrouped';
  if (!grouped[group]) grouped[group] = [];
  grouped[group].push(p);
});

Object.keys(grouped).sort().forEach(group => {
  console.log(`=== ${group} (${grouped[group].length}) ===`);
  grouped[group].forEach(p => {
    const type = p.permission_type === 'supplier' ? ' [SUPPLIER]' : '';
    console.log(`  ${p.name}${type}`);
  });
  console.log('');
});
