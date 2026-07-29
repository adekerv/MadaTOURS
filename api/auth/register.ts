import type { VercelRequest, VercelResponse } from '@vercel/node';
import { query } from '../../src/lib/db-server';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const existing = await query('SELECT * FROM users WHERE email = ?', [email]);
    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'Email is already registered.' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const role = normalizedEmail.includes('admin') ? 'admin' : 'user';

    await query('INSERT INTO users (email, password, role) VALUES (?, ?, ?)', [
      normalizedEmail,
      password,
      role
    ]);

    const insertedUserList = await query('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
    const newUser = insertedUserList[0] || { id: Date.now(), email: normalizedEmail, role };

    return res.status(201).json({
      success: true,
      user: { id: newUser.id, email: newUser.email, role: newUser.role }
    });
  } catch (err: any) {
    console.error('Vercel Auth Register Error:', err);
    return res.status(500).json({ error: err.message || 'Registration failed' });
  }
}
