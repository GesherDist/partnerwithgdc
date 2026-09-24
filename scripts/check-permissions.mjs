import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://oejfbxycppqxtsspnejr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lamZieHljcHBxeHRzc3BuZWpyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTIwNzkzMywiZXhwIjoyMTAwNzgzOTMzfQ.KYpIKteReeKxJDXBGnZDzkHT1B9-01o-PMmEAFyQCuM'
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
