# Autonomi — Payment Infrastructure for AI Agents

Landing page and waitlist backend for Autonomi, the autonomous payment API built for AI agents.

## Pages
- `/` — Homepage with waitlist form
- `/how-it-works.html` — Step-by-step explainer + FAQ
- `/features.html` — Full feature grid + competitor comparison
- `/pricing.html` — Plans and pricing (currently hidden from nav)
- `/privacy.html` — Privacy Policy
- `/terms.html` — Terms of Service
- `/admin` — Admin dashboard (password-protected)

## Tech Stack
- **Server:** Express.js (Node.js)
- **Database:** PostgreSQL (via Railway)
- **Frontend:** Pure HTML/CSS/JS — no build step
- **Fonts:** Space Grotesk, DM Sans (Google Fonts)
- **Deployment:** Railway

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (auto-injected by Railway) |
| `ADMIN_PASSWORD` | Yes | Password for the admin dashboard |
| `PORT` | No | Server port (defaults to 3000) |

## Local Development

```bash
npm install
DATABASE_URL=postgres://... ADMIN_PASSWORD=yourpassword node server.js
```

Then open http://localhost:3000

## Deploy on Railway

1. Push this repo to GitHub
2. Connect Railway to your GitHub repo
3. Add a PostgreSQL plugin
4. Set `ADMIN_PASSWORD` in Railway environment variables
5. Railway auto-deploys on push
