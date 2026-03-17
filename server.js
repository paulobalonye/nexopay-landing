const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Postgres connection — Railway injects DATABASE_URL automatically
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});

// Admin password — set via Railway env var ADMIN_PASSWORD
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'autonomi2026';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── DB SETUP ───────────────────────────────────────────────────────────────
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS waitlist (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      company TEXT,
      use_case TEXT,
      monthly_volume TEXT,
      source TEXT DEFAULT 'Landing Page',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('✅ Database ready');
}

// ─── API: SUBMIT WAITLIST ────────────────────────────────────────────────────
app.post('/api/waitlist', async (req, res) => {
  const { name, email, company, use_case, monthly_volume } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO waitlist (name, email, company, use_case, monthly_volume)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [name, email, company || '', use_case || '', monthly_volume || '']
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    if (err.code === '23505') {
      // Duplicate email
      return res.status(409).json({ error: 'This email is already on the waitlist!' });
    }
    console.error('DB error:', err);
    res.status(500).json({ error: 'Server error, please try again' });
  }
});

// ─── ADMIN: AUTH CHECK ───────────────────────────────────────────────────────
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true, token: Buffer.from(ADMIN_PASSWORD).toString('base64') });
  } else {
    res.status(401).json({ error: 'Wrong password' });
  }
});

// ─── ADMIN: GET ALL LEADS ────────────────────────────────────────────────────
app.get('/api/admin/leads', async (req, res) => {
  const auth = req.headers.authorization;
  const expected = 'Bearer ' + Buffer.from(ADMIN_PASSWORD).toString('base64');
  if (auth !== expected) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const result = await pool.query(
      `SELECT * FROM waitlist ORDER BY created_at DESC`
    );
    res.json({ leads: result.rows, total: result.rows.length });
  } catch (err) {
    res.status(500).json({ error: 'DB error' });
  }
});

// ─── ADMIN: DELETE LEAD ──────────────────────────────────────────────────────
app.delete('/api/admin/leads/:id', async (req, res) => {
  const auth = req.headers.authorization;
  const expected = 'Bearer ' + Buffer.from(ADMIN_PASSWORD).toString('base64');
  if (auth !== expected) return res.status(401).json({ error: 'Unauthorized' });

  await pool.query('DELETE FROM waitlist WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

// ─── ADMIN: EXPORT CSV ───────────────────────────────────────────────────────
app.get('/api/admin/export', async (req, res) => {
  const auth = req.headers.authorization;
  const expected = 'Bearer ' + Buffer.from(ADMIN_PASSWORD).toString('base64');
  if (auth !== expected) return res.status(401).json({ error: 'Unauthorized' });

  const result = await pool.query(`SELECT * FROM waitlist ORDER BY created_at DESC`);
  const rows = result.rows;

  const csv = [
    'ID,Name,Email,Company,Use Case,Monthly Volume,Source,Joined',
    ...rows.map(r =>
      `${r.id},"${r.name}","${r.email}","${r.company}","${r.use_case}","${r.monthly_volume}","${r.source}","${r.created_at}"`
    )
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=autonomi-waitlist.csv');
  res.send(csv);
});

// ─── SERVE PAGES ─────────────────────────────────────────────────────────────
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('*', (req, res) => {
  const page = req.path === '/' ? 'index.html' : req.path.replace('/', '');
  const filePath = path.join(__dirname, 'public', page);
  res.sendFile(filePath, err => {
    if (err) res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
});

// ─── START ───────────────────────────────────────────────────────────────────
async function startServer() {
  app.listen(PORT, () => console.log(`🚀 Autonomi running on port ${PORT}`));
  for (let i = 1; i <= 5; i++) {
    try {
      await initDB();
      return;
    } catch (err) {
      console.error(`DB init attempt ${i}/5 failed:`, err.message);
      if (i < 5) await new Promise(r => setTimeout(r, 3000 * i));
    }
  }
  console.error('All DB init attempts failed. Server running without DB.');
}
startServer();
