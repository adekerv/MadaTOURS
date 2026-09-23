import { config } from 'dotenv';
import { adminClient } from '../server/supabase';
config({ path: ['.env.local', '.env'] });
const email = process.argv[2]?.trim().toLowerCase();
if (!email || !email.includes('@'))
  throw new Error('Usage: npm run admin:grant -- your-confirmed-account@example.com');
const client = adminClient();
let found: string | undefined;
for (let page = 1; page <= 100; page++) {
  const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
  if (error)
    throw new Error(
      'Could not read Supabase accounts. Check the server-only secret and project URL.',
    );
  const user = data.users.find((user) => user.email?.toLowerCase() === email);
  if (user) {
    if (!user.email_confirmed_at)
      throw new Error('Confirm this account’s email before granting admin access.');
    found = user.id;
    break;
  }
  if (data.users.length < 1000) break;
}
if (!found) throw new Error('Create and verify this account in the app first.');
const { error } = await client
  .from('mt_profiles')
  .update({ role: 'admin' })
  .eq('id', found)
  .select('id')
  .single();
if (error) throw new Error('Could not grant admin access. Run the Supabase setup SQL first.');
console.log('Admin access granted to the selected account. Reload the app to refresh its role.');
