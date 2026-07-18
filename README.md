# 🩸 BloodLink — Blood & Plasma Donor Finder

A privacy-first web app to find verified blood and plasma donors near you.
Built with **React (Vite)** + **Supabase** (free tier).

## Why it's different
- ⚡ **Real-time availability** — donors toggle "available now"; search results update live.
- 📍 **Hyperlocal** — filter by city and area, so results are actually nearby.
- 💬 **WhatsApp-first** — works in any browser; contact happens over WhatsApp, no app install.
- 🔒 **Privacy by design** — a donor's phone number is stored in a separate, locked table that
  the app can never read. Seekers send a request; the **donor** decides whether to reply.

## How privacy works (the important bit)
- Public, searchable info lives in `donors` — it has **no phone column**.
- Phone numbers live in `donor_contacts`, protected by Row Level Security with **no public policy**.
- All writes go through `SECURITY DEFINER` database functions (RPCs) — the only path to private data.
- Seekers never see a number. Donors reply via a `wa.me` link, so their number is shared only if
  and when they choose to message the seeker.

---

## Setup (about 3 minutes)

### 1. Create a free Supabase project
1. Go to https://supabase.com and sign up (free).
2. Click **New project**, give it a name and a database password, pick a region near you.
3. Wait ~1 minute for it to provision.

### 2. Run the database schema
1. In your project, open **SQL Editor → New query**.
2. Copy everything from [`supabase/schema.sql`](supabase/schema.sql) and paste it in.
3. Click **Run**. You should see "Success".

### 3. Add your keys
1. Open **Project Settings → API**.
2. Copy the **Project URL** and the **anon public** key.
3. Open the `.env` file in this folder and paste them:
   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```

### 4. Run it
```bash
npm install     # already done if you're reading this
npm run dev
```
Open http://localhost:5173

---

## Using the app
- **Find donors** — pick blood group + city/area, see who's available now, send a request.
- **Become a donor** — register (your phone stays private).
- **Donor dashboard** — enter your registered phone, toggle availability, see requests,
  and reply to seekers on WhatsApp.

## Tech
| Layer | Choice |
|-------|--------|
| Frontend | React 18 + Vite |
| Backend | Supabase (Postgres + RPCs + Realtime + RLS) |
| Contact | WhatsApp deep links (`wa.me`) |
| Hosting | Deploy the `dist/` build free on Vercel / Netlify / Cloudflare Pages |

## Roadmap / production hardening
- Replace phone-as-key dashboard with **Supabase phone OTP auth**.
- Add rate limiting on `create_request` to prevent spam.
- Optional server-side WhatsApp/SMS notifications to donors (Supabase Edge Function).
- Map view + distance sorting.
- Compatibility hints (which blood groups can donate to which).

## Project structure
```
blood-donor-finder/
├── index.html
├── .env                     # your Supabase keys (git-ignored)
├── supabase/schema.sql      # run this in Supabase SQL editor
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── supabaseClient.js
    ├── api.js               # all RPC / query calls
    ├── constants.js
    ├── index.css
    └── components/
        ├── Header.jsx
        ├── SearchDonors.jsx
        ├── DonorCard.jsx
        ├── RequestModal.jsx
        ├── RegisterDonor.jsx
        └── DonorDashboard.jsx
```
