import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabaseUrl = 'https://sfqtmnncgiqkveaoqckt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxdGRrZG1lZnJzdm50eWtpaXJ3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTAxMTQzMCwiZXhwIjoyMDc0NTg3NDMwfQ.JkK6fle3HwVsUvvyJohuvdrTmJevmsiuLduhBBAABco';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('📦 Reading migration file...');
  const sql = readFileSync('./supabase/migrations/20251012032000_add_role_registration_fields.sql', 'utf8');

  console.log('🚀 Applying migration...');

  // Split by semicolons and execute each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('/*') && !s.startsWith('--'));

  for (const statement of statements) {
    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql: statement });
      if (error) {
        console.error('❌ Error:', error);
      } else {
        console.log('✅ Statement executed successfully');
      }
    } catch (err) {
      console.error('❌ Exception:', err);
    }
  }

  console.log('✅ Migration completed!');
}

applyMigration();
