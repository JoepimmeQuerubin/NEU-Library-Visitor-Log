# 📚 NEU Library Visitor Log System

A web-based visitor management system for the **New Era University Library Department**. It allows students and staff to log their library visits, while administrators can monitor activity, manage users, view statistics, and generate reports.

---

## 🌐 Live Demo

> Replace this with your actual Netlify/Vercel URL after deployment
> `https://neulibraryvisitorlog.netlify.app/`

---

## ✨ Features

### For Students / Regular Users
- Sign in with **Google** (`@neu.edu.ph` accounts only) or **email**
- **Check in and check out** of the library
- Select visit reason, college, and employee type
- View **personal visit history**
- Personal dashboard with stats — total visits, hours logged, day streak, library rank

### For Administrators
- **Admin Overview** — today's visit stats and charts (by reason and college)
- **Live Monitor** — see who is currently inside the library, force check-out, block users
- **All Visitor Logs** — full history with search, autocomplete, sort, and date filters (Today / This Week / This Month / Custom Range)
- **Manage Users** — add, edit, block/unblock users
- **Statistics** — filterable charts by period, reason, college, and type
- **Activity Logs** — full audit trail of all system events
- **Reports** — filter by date range and college, export to **Excel** or **PDF**

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, Vanilla JavaScript |
| Database | Supabase (PostgreSQL) |
| Authentication | Google OAuth 2.0 |
| Charts | Chart.js |
| Excel Export | SheetJS (xlsx) |
| PDF Export | jsPDF + jsPDF-AutoTable |
| Icons | Font Awesome 6 |
| Fonts | Playfair Display, Crimson Pro, DM Mono |
| Hosting | Netlify / Vercel |

---

## 📁 Project Structure

```
/
├── index.html          # All pages and UI (single-page app)
├── style.css           # All styling — Grand Library dark theme
├── script.js           # All logic — Supabase, auth, charts, filters
├── neu-logo.svg        # NEU University seal (used in UI + browser tab)
├── seed_data.sql       # Sample student profiles + visit logs for Supabase
├── SUPABASE_SETUP.md   # Database setup instructions and SQL
└── README.md           # This file
```

---

## 🚀 Getting Started

### Prerequisites
- A [Supabase](https://supabase.com) account (free tier works)
- A [Google Cloud Console](https://console.cloud.google.com) account (for OAuth)
- A static hosting account — [Netlify](https://netlify.com) or [Vercel](https://vercel.com)

---

### Step 1 — Set Up Supabase

1. Create a new Supabase project
2. Go to **SQL Editor** and run the SQL from `SUPABASE_SETUP.md` to create the three tables:
   - `profiles` — user accounts
   - `visitor_logs` — check-in/check-out records
   - `activity_logs` — admin audit trail
3. The file also includes all required **Row Level Security (RLS) policies**

---

### Step 2 — Set Up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com) → **APIs & Services → Credentials**
2. Create an **OAuth 2.0 Client ID** (Web application type)
3. Under **Authorized JavaScript Origins**, add:
   - `http://localhost` (for local testing)
   - `https://your-site-name.netlify.app` (your deployed URL)
4. Copy your **Client ID**

---

### Step 3 — Configure index.html

Open `index.html` and find this line (around line 68):

```html
data-client_id="YOUR_GOOGLE_CLIENT_ID"
```

Replace it with your actual Client ID:

```html
data-client_id="123456789-abc.apps.googleusercontent.com"
```

---

### Step 4 — Deploy

**Netlify (easiest):**
1. Go to [netlify.com](https://netlify.com)
2. Drag your entire project folder onto the deploy area
3. Your site is live instantly

**Vercel:**
1. Push your files to a GitHub repository
2. Go to [vercel.com](https://vercel.com) → Import Project → connect your repo
3. Vercel auto-deploys on every push

---

### Step 5 — Create Your Admin Account

After deploying, run this in Supabase **SQL Editor** to create your admin profile:

```sql
INSERT INTO profiles (email, name, student_id, college, employee_type, role, registered_at, is_blocked)
VALUES (
  'youremail@neu.edu.ph',
  'Your Full Name',
  '2025-00001',
  'Administration',
  'Employee',
  'admin',
  NOW(),
  false
);
```

Then visit your site, choose **Administrator** on the landing screen, and sign in.

---

### Step 6 — (Optional) Populate with Sample Data

To make your dashboard look populated immediately, run `seed_data.sql` in Supabase SQL Editor. It inserts **19 sample students** with **83 visit logs** spread across March 2025.

---

## 🔐 Access Control

| Role | Access |
|---|---|
| `user` | Personal dashboard, check-in/out, visit history |
| `admin` | Full admin panel — all pages and management tools |

- Only `@neu.edu.ph` email addresses can sign in
- Any user can be promoted to `admin` by updating `role = 'admin'` in the `profiles` table
- The email `jcesperanza@neu.edu.ph` is automatically elevated to admin on first sign-in

---

## 📊 Database Schema

### `profiles`
| Column | Type | Description |
|---|---|---|
| id | uuid | Primary key |
| email | text | Unique, `@neu.edu.ph` only |
| name | text | Full name |
| student_id | text | Student or employee ID |
| college | text | College/department |
| employee_type | text | `Student` or `Employee` |
| role | text | `user` or `admin` |
| registered_at | timestamptz | Account creation date |
| picture | text | Google profile photo URL |
| is_blocked | boolean | Block status |

### `visitor_logs`
| Column | Type | Description |
|---|---|---|
| id | serial | Primary key |
| email | text | Visitor email |
| name | text | Visitor name |
| student_id | text | ID number |
| college | text | College/department |
| reason | text | Reason for visit |
| employee_type | text | `Student` or `Employee` |
| date | date | Visit date |
| time_in | text | Check-in time (HH:MM) |
| time_out | text | Check-out time (nullable) |

### `activity_logs`
| Column | Type | Description |
|---|---|---|
| id | serial | Primary key |
| performed_by | text | Email of who did the action |
| action | text | Action type (login, check-in, etc.) |
| detail | text | Additional detail |
| created_at | timestamptz | Timestamp |

---

## 🎨 Design

The UI is themed after a **grand classical library** — warm mahogany tones, aged gold accents, lamplight amber, and parchment backgrounds. The login page features a real library interior photograph with a dark frosted glass card overlay.

- **Font pairing:** Playfair Display (headings) + Crimson Pro (body) + DM Mono (data/code)
- **Color palette:** Deep wood browns, aged gold (`#c9a84c`), NEU green (`#1a5c2a`)
- **Responsive** — works on desktop, tablet, and mobile

---

## 👨‍💻 Developer Notes

- The app is a **single-page application** — all pages are sections inside `index.html`, toggled with JavaScript
- Supabase is accessed directly from the frontend using the **anon key** — all security is enforced via **Row Level Security** policies in Supabase
- Charts are rebuilt on every filter change using **Chart.js** with instances tracked in `chartInstances` to avoid memory leaks
- Sessions are **not persisted** across page loads by design — users must sign in each visit for security

---

## 📄 License

This project was built for **New Era University — Library Department**.
For academic and institutional use only.

---

*Built with ❤️ for NEU Library · 2025*
