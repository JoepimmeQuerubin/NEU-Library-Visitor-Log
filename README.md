<div align="center">
  # NEU Library Visitor Log System
  ### New Era University — Library Department

  ![Status](https://img.shields.io/badge/status-live-brightgreen)
  ![Stack](https://img.shields.io/badge/stack-HTML%20%7C%20CSS%20%7C%20JS-gold)
  ![Database](https://img.shields.io/badge/database-Supabase-3ECF8E)
  ![Auth](https://img.shields.io/badge/auth-Google%20OAuth-4285F4)

  > A web-based system for tracking library visitors at NEU. Students can check in and out, while admins can monitor, manage, and generate reports.

  <div align="center">
  <a href="https://neulibraryvisitorlog.netlify.app/" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #3ECF8E 0%, #2ecc71 100%); color: white; font-size: 20px; font-weight: bold; padding: 15px 40px; text-decoration: none; border-radius: 50px; box-shadow: 0 4px 15px rgba(62,207,142,0.3); transition: all 0.3s ease;">
    🌐 LIVE SITE 🌐
  </a>
</div>

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
| 🎭 Icons | Font Awesome 6 |
| 🚀 Hosting | Netlify |

---

## 📁 Project Files

```
📦 neu-library/
├── 📄 index.html          — All pages (single-page app)
├── 🎨 style.css           — Grand Library dark theme
├── ⚙️  script.js           — All logic and Supabase integration
├── 🖼️  neu-logo.svg        — NEU University seal
├── 🗄️  SUPABASE_SETUP.md   — Database setup instructions
└── 📖 README.md            — This file
```
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
