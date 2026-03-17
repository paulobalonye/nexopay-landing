# Autonomi — Payment Infrastructure for AI Agents

Landing page for Autonomi, the autonomous payment API built for AI agents.

## Pages
- `/` — Homepage with waitlist form (Airtable-connected)
- `/how-it-works.html` — Step-by-step explainer + FAQ
- `/features.html` — Full feature grid + competitor comparison
- `/pricing.html` — Plans, transaction fees, pricing FAQ
- `/privacy.html` — Privacy Policy
- `/terms.html` — Terms of Service

## Setup: Airtable Waitlist

1. Create a free [Airtable](https://airtable.com) account
2. Create a new base called **Autonomi Waitlist**
3. Create a table called **Waitlist** with these fields:
   - `First Name` (Single line text)
   - `Last Name` (Single line text)
   - `Email` (Email)
   - `Company` (Single line text)
   - `Use Case` (Single select)
   - `Monthly Volume` (Single select)
   - `Submitted At` (Date)
   - `Source` (Single line text)
4. Get your [Airtable API key](https://airtable.com/account)
5. Get your Base ID from the Airtable API docs URL
6. In `index.html`, replace:
   ```js
   const AIRTABLE_API_KEY = 'YOUR_AIRTABLE_API_KEY';
   const AIRTABLE_BASE_ID = 'YOUR_BASE_ID';
   ```

## Deploy on Railway

1. Push this repo to GitHub
2. Connect Railway to your GitHub repo
3. Railway will auto-detect it as a static site
4. Set the start command to serve static files (or use Railway's static hosting)

## Local Development

```bash
# Serve locally with any static file server
npx serve .
# or
python3 -m http.server 3000
```

Then open http://localhost:3000

## Tech
- Pure HTML/CSS/JS — no build step required
- Google Fonts (Syne, DM Mono, Instrument Serif)
- Airtable REST API for form submissions
- Deployed as static site on Railway
