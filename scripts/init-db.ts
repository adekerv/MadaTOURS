import 'dotenv/config';
import { getDatabase, initializeDatabase } from '../server/db';
const db = await getDatabase();
try {
  await initializeDatabase(db);
  console.log('Database initialized. No user or admin accounts were seeded.');
} finally {
  await db.close();
}
