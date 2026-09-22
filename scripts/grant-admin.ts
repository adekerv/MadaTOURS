import 'dotenv/config';
import { getDatabase } from '../server/db';
const email = process.argv[2]?.trim().toLowerCase();
if (!email) throw new Error('Usage: npm run admin:grant -- owner@example.com');
const db = await getDatabase();
try {
  const updated = await db.query("UPDATE users SET role = 'admin' WHERE email = $1 RETURNING id", [
    email,
  ]);
  if (!updated.length)
    throw new Error('Register this account in the app before granting admin access.');
  console.log('Admin access granted.');
} finally {
  await db.close();
}
