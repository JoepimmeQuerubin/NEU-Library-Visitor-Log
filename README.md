<div align="center">
  <img src="neu-logo.svg" width="100" alt="NEU Logo" />

  # NEU Library Visitor Log System
  ### New Era University — Library Department

  ![Status](https://img.shields.io/badge/status-live-brightgreen)
  ![Stack](https://img.shields.io/badge/stack-HTML%20%7C%20CSS%20%7C%20JS-gold)
  ![Database](https://img.shields.io/badge/database-Supabase-3ECF8E)
  ![Auth](https://img.shields.io/badge/auth-Google%20OAuth-4285F4)

  > A web-based system for tracking library visitors at NEU. Students can check in and out, while admins can monitor, manage, and generate reports.

  **[🌐 Live Site](https://neulibraryvisitorlog.netlify.app/)** &nbsp;·&nbsp;
</div>

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Files](#-project-files)
- [Setup Guide](#-setup-guide)
- [Database Schema](#-database-schema)
- [Access & Roles](#-access--roles)

---

## ✨ Features

### 👤 For Students
- Sign in with **Google** or **email** (`@neu.edu.ph` only)
- **Check in/out** with reason, college, and type
- Personal dashboard — visits, hours, streak, rank
- View full visit history

### 🛡️ For Administrators
- **Overview** — today's stats and charts
- **Live Monitor** — see who's inside, force check-out, block users
- **All Visitor Logs** — search, filter by date (Today / Week / Month / Custom)
- **Manage Users** — add, edit, block/unblock
- **Statistics** — charts filterable by period, reason, college, and type
- **Activity Logs** — full audit trail
- **Reports** — filter and export to **Excel** or **PDF**

---

## 🛠️ Tech Stack

| | Technology |
|---|---|
| 🎨 Frontend | HTML, CSS, Vanilla JavaScript |
| 🗄️ Database | Supabase (PostgreSQL) |
| 🔐 Auth | Google OAuth 2.0 |
| 📊 Charts | Chart.js |
| 📁 Export | SheetJS (Excel) + jsPDF (PDF) |
| 🎭 Icons | Font Awesome 6 |
| 🚀 Hosting | Netlify / Vercel |

---

## 📁 Project Files

```
📦 neu-library/
├── 📄 index.html          — All pages (single-page app)
├── 🎨 style.css           — Grand Library dark theme
├── ⚙️  script.js           — All logic and Supabase integration
├── 🖼️  neu-logo.svg        — NEU University seal
├── 🌱 seed_data.sql        — Sample students + visit history
├── 🗄️  SUPABASE_SETUP.md   — Database setup instructions
└── 📖 README.md            — This file
```

---

## 🚀 Setup Guide

### 1️⃣ &nbsp; Set Up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the SQL from `SUPABASE_SETUP.md`
3. This creates the `profiles`, `visitor_logs`, and `activity_logs` tables

### 2️⃣ &nbsp; Set Up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com) → **Credentials**
2. Create an **OAuth 2.0 Client ID** (Web application)
3. Add your site URL under **Authorized JavaScript Origins**
4. Copy your **Client ID**

### 3️⃣ &nbsp; Add Your Client ID

Open `index.html` and replace:
```html
data-client_id="YOUR_GOOGLE_CLIENT_ID"
```
with your actual Client ID:
```html
data-client_id="123456789-abc.apps.googleusercontent.com"
```

### 4️⃣ &nbsp; Deploy

**Netlify** — drag your project folder to [netlify.com/drop](https://app.netlify.com/drop)

**Vercel** — push to GitHub, then import at [vercel.com](https://vercel.com)

### 5️⃣ &nbsp; Create Your Admin Account

Run this in Supabase **SQL Editor**:
```sql
INSERT INTO profiles (email, name, student_id, college, employee_type, role, registered_at, is_blocked)
VALUES (
  'youremail@neu.edu.ph', 'Your Name', '2025-00001',
  'Administration', 'Employee', 'admin', NOW(), false
);
```

### 6️⃣ &nbsp; (Optional) Add Sample Data

Run `seed_data.sql` in Supabase SQL Editor to insert **19 students** and **83 visit logs**.

---

## 🗄️ Database Schema

<details>
<summary><strong>profiles</strong> — user accounts</summary>

| Column | Type | Notes |
|---|---|---|
| email | text | Unique, `@neu.edu.ph` only |
| name | text | Full name |
| student_id | text | ID number |
| college | text | CICS, CEBA, CED, CEA, CHS, CLA |
| employee_type | text | `Student` or `Employee` |
| role | text | `user` or `admin` |
| is_blocked | boolean | Block status |

</details>

<details>
<summary><strong>visitor_logs</strong> — check-in records</summary>

| Column | Type | Notes |
|---|---|---|
| email | text | Visitor email |
| name | text | Visitor name |
| college | text | College/department |
| reason | text | Reason for visit |
| date | date | Visit date |
| time_in | text | HH:MM |
| time_out | text | HH:MM, nullable |

</details>

<details>
<summary><strong>activity_logs</strong> — audit trail</summary>

| Column | Type | Notes |
|---|---|---|
| performed_by | text | Who did the action |
| action | text | login, check-in, block-user, etc. |
| detail | text | Extra info |
| created_at | timestamptz | Timestamp |

</details>

---

## 🔐 Access & Roles

| Role | Access |
|---|---|
| `user` | Dashboard, check-in/out, personal history |
| `admin` | Full admin panel — all pages and tools |

- Only `@neu.edu.ph` emails are allowed
- Promote any user to admin by setting `role = 'admin'` in Supabase
- `jcesperanza@neu.edu.ph` is auto-elevated to admin on first sign-in

---

<div align="center">
  <sub>Built for NEU Library · 2025 · New Era University, Philippines</sub>
</div>
