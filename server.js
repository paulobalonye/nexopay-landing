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

// Admin password — set via Railway env var ADMIN_PASSWORD (no default)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// ─── RATE LIMITER (in-memory, no dependencies) ─────────────────────────────
const loginAttempts = new Map(); // IP -> { count, firstAttempt }
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 5;

function isRateLimited(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record) return false;
  if (now - record.firstAttempt > RATE_LIMIT_WINDOW) {
    loginAttempts.delete(ip);
    return false;
  }
  return record.count >= RATE_LIMIT_MAX;
}

function recordFailedAttempt(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);
  if (!record || now - record.firstAttempt > RATE_LIMIT_WINDOW) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
  } else {
    loginAttempts.set(ip, { ...record, count: record.count + 1 });
  }
}

function clearAttempts(ip) {
  loginAttempts.delete(ip);
}

// ─── VALIDATION HELPERS ─────────────────────────────────────────────────────
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INPUT_LIMITS = { name: 200, email: 254, company: 200 };

function sanitizeCsvCell(value) {
  const str = String(value == null ? '' : value).replace(/"/g, '""');
  if (/^[=+\-@]/.test(str)) return "'" + str;
  return str;
}

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

// ─── ADMIN AUTH MIDDLEWARE ────────────────────────────────────────────────────
function requireAdmin(req, res) {
  if (!ADMIN_PASSWORD) {
    res.status(503).json({ error: 'Admin not configured' });
    return false;
  }
  const auth = req.headers.authorization;
  const expected = 'Bearer ' + Buffer.from(ADMIN_PASSWORD).toString('base64');
  if (auth !== expected) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

// ─── API: SUBMIT WAITLIST ────────────────────────────────────────────────────
app.post('/api/waitlist', async (req, res) => {
  const { name, email, company, use_case, monthly_volume } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  // Input length limits
  if (typeof name === 'string' && name.length > INPUT_LIMITS.name) {
    return res.status(400).json({ error: 'Name must be 200 characters or fewer' });
  }
  if (typeof email === 'string' && email.length > INPUT_LIMITS.email) {
    return res.status(400).json({ error: 'Email must be 254 characters or fewer' });
  }
  if (company && typeof company === 'string' && company.length > INPUT_LIMITS.company) {
    return res.status(400).json({ error: 'Company must be 200 characters or fewer' });
  }

  // Email format validation
  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
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
  if (!ADMIN_PASSWORD) {
    return res.status(503).json({ error: 'Admin not configured' });
  }

  const ip = req.ip || req.connection.remoteAddress;
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many failed attempts. Try again later.' });
  }

  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    clearAttempts(ip);
    res.json({ success: true, token: Buffer.from(ADMIN_PASSWORD).toString('base64') });
  } else {
    recordFailedAttempt(ip);
    res.status(401).json({ error: 'Wrong password' });
  }
});

// ─── ADMIN: GET ALL LEADS ────────────────────────────────────────────────────
app.get('/api/admin/leads', async (req, res) => {
  if (!requireAdmin(req, res)) return;

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
  if (!requireAdmin(req, res)) return;

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid id: must be a positive integer' });
  }

  await pool.query('DELETE FROM waitlist WHERE id = $1', [id]);
  res.json({ success: true });
});

// ─── ADMIN: EXPORT CSV ───────────────────────────────────────────────────────
app.get('/api/admin/export', async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const result = await pool.query(`SELECT * FROM waitlist ORDER BY created_at DESC`);
  const rows = result.rows;

  const csv = [
    'ID,Name,Email,Company,Use Case,Monthly Volume,Source,Joined',
    ...rows.map(r =>
      `${r.id},"${sanitizeCsvCell(r.name)}","${sanitizeCsvCell(r.email)}","${sanitizeCsvCell(r.company)}","${sanitizeCsvCell(r.use_case)}","${sanitizeCsvCell(r.monthly_volume)}","${sanitizeCsvCell(r.source)}","${sanitizeCsvCell(r.created_at)}"`
    )
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=autonomi-waitlist.csv');
  res.send(csv);
});

// ─── SERVE PAGES ─────────────────────────────────────────────────────────────
app.get('/admin', (_req, res) => {
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
