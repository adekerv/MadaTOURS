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
    const normalizedEmail = String(email).toLowerCase().trim();
    const users = await query('SELECT * FROM users WHERE email = ?', [normalizedEmail]);

    if (!users || users.length === 0) {
      return res.status(401).json({ error: 'Account not found. Please register first.' });
    }

    const userObj = users[0];
    if (userObj.password !== password) {
      return res.status(401).json({ error: 'Invalid password credentials.' });
    }

    return res.status(200).json({
      success: true,
      user: { id: userObj.id, email: userObj.email, role: userObj.role }
    });
  } catch (err: any) {
    console.error('Vercel Auth Login Error:', err);
    return res.status(500).json({ error: err.message || 'Login failed' });
  }
}
