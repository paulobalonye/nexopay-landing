const express = require('express');
const { Pool } = require('pg');
const { Resend } = require('resend');
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

// Resend email client — set RESEND_API_KEY via Railway env var
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const EMAIL_FROM = 'Autonomi <noreply@hitchpay.ng>';

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

// ─── WAITLIST EMAIL ──────────────────────────────────────────────────────────
function buildWaitlistEmail(firstName) {
  return `<div style="margin:0;padding:0;background-color:#060608;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#060608;">
<tr><td align="center" style="padding:40px 20px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;">
  <tr><td style="padding:32px 40px 24px;text-align:left;"><span style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:24px;font-weight:800;color:#f5f4f0;letter-spacing:-0.5px;">Autono<span style="color:#00e5a0;">mi</span></span></td></tr>
  <tr><td style="padding:0 40px;"><div style="height:2px;background:linear-gradient(90deg,#00e5a0,#0af,#ff6b35);border-radius:2px;"></div></td></tr>
  <tr><td style="padding:48px 40px 32px;"><h1 style="margin:0 0 8px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:32px;font-weight:800;color:#f5f4f0;letter-spacing:-0.02em;line-height:1.1;">You're in.</h1><p style="margin:0;font-size:14px;color:#00e5a0;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;">Waitlist confirmed</p></td></tr>
  <tr><td style="padding:0 40px 32px;"><p style="margin:0 0 20px;font-size:16px;color:#c8c8d0;line-height:1.7;">Hey ${firstName},</p><p style="margin:0 0 20px;font-size:16px;color:#c8c8d0;line-height:1.7;">Thanks for signing up for early access to Autonomi &mdash; the payment infrastructure API built for AI agents.</p><p style="margin:0;font-size:16px;color:#c8c8d0;line-height:1.7;">We're onboarding developers in small batches during our private beta. You'll hear from us within <strong style="color:#f5f4f0;">48 hours</strong> with your API key and onboarding guide.</p></td></tr>
  <tr><td style="padding:0 40px 40px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#111118;border:1px solid rgba(255,255,255,0.07);"><tr><td style="padding:28px 32px;"><p style="margin:0 0 16px;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#00e5a0;font-weight:600;">What's included in early access</p><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="padding:6px 0;font-size:15px;color:#c8c8d0;line-height:1.6;"><span style="color:#00e5a0;margin-right:10px;">&#10003;</span> Free API credits to start building</td></tr><tr><td style="padding:6px 0;font-size:15px;color:#c8c8d0;line-height:1.6;"><span style="color:#00e5a0;margin-right:10px;">&#10003;</span> Early pricing lock &mdash; your rate stays forever</td></tr><tr><td style="padding:6px 0;font-size:15px;color:#c8c8d0;line-height:1.6;"><span style="color:#00e5a0;margin-right:10px;">&#10003;</span> Direct Slack channel with the founding team</td></tr><tr><td style="padding:6px 0;font-size:15px;color:#c8c8d0;line-height:1.6;"><span style="color:#00e5a0;margin-right:10px;">&#10003;</span> Python, Node.js &amp; TypeScript SDKs on Day 1</td></tr></table></td></tr></table></td></tr>
  <tr><td style="padding:0 40px 40px;text-align:left;"><a href="https://autonomi.io/how-it-works.html" style="display:inline-block;background-color:#00e5a0;color:#060608;padding:16px 36px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:14px;font-weight:700;letter-spacing:0.05em;text-decoration:none;text-transform:uppercase;">See How It Works &rarr;</a></td></tr>
  <tr><td style="padding:0 40px;"><div style="height:1px;background-color:rgba(255,255,255,0.07);"></div></td></tr>
  <tr><td style="padding:32px 40px;"><p style="margin:0 0 16px;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#6b6b7a;font-weight:600;">While you wait</p><p style="margin:0;font-size:14px;color:#9b9baa;line-height:1.7;">Explore our <a href="https://autonomi.io/features.html" style="color:#00e5a0;text-decoration:none;">feature overview</a> to see what you'll be building with &mdash; from sub-2ms settlements to smart contract escrow and programmable spending rules.</p></td></tr>
  <tr><td style="padding:0 40px;"><div style="height:1px;background-color:rgba(255,255,255,0.07);"></div></td></tr>
  <tr><td style="padding:32px 40px;"><p style="margin:0 0 4px;font-family:'Helvetica Neue',Arial,sans-serif;font-size:16px;font-weight:800;color:#f5f4f0;letter-spacing:-0.5px;">Autono<span style="color:#00e5a0;">mi</span></p><p style="margin:0 0 16px;font-size:12px;color:#6b6b7a;">Payments infrastructure for the AI agent economy.</p><p style="margin:0;font-size:11px;color:#4a4a56;line-height:1.6;">&copy; 2026 Autonomi Inc. All rights reserved.<br>You're receiving this because you signed up at autonomi.io.<br><a href="#" style="color:#6b6b7a;text-decoration:underline;">Unsubscribe</a></p></td></tr>
</table>
</td></tr></table></div>`;
}

async function sendWaitlistEmail(email, firstName) {
  if (!resend) {
    console.warn('RESEND_API_KEY not set — skipping waitlist email');
    return;
  }
  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: email,
      subject: "You're on the Autonomi waitlist",
      html: buildWaitlistEmail(firstName),
    });
    if (error) {
      console.error('Resend error:', error);
    } else {
      console.log(`✉️ Waitlist email sent to ${email}`);
    }
  } catch (err) {
    console.error('Email send failed:', err.message);
  }
}

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

    // Fire-and-forget: send welcome email without blocking the response
    const firstName = name.split(' ')[0];
    sendWaitlistEmail(email, firstName);
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
