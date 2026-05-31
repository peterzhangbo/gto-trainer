# Supabase Setup Guide

Follow these steps to connect the GTO Trainer to a Supabase backend.

---

## 1. Create a Supabase Account

1. Go to [https://supabase.com](https://supabase.com) and sign up (GitHub or email).
2. Once logged in you will land on the Dashboard.

## 2. Create a New Project

1. Click **New Project**.
2. Choose an organization (or create one).
3. Enter a **Project Name** (e.g. `gto-trainer`).
4. Set a strong **Database Password** — save it somewhere safe.
5. Pick the **Region** closest to you.
6. Click **Create new project** and wait for it to provision (~2 minutes).

## 3. Run the SQL Migrations

The project ships with three migration files under `supabase/migrations/`.  
Run them **in order** inside the Supabase SQL Editor.

### 3a. Open the SQL Editor

1. In the Supabase Dashboard, click **SQL Editor** in the left sidebar.
2. You can paste each file's contents into a new query and click **Run**, or use the **New query** button for each.

### 3b. Run the Migrations

| File | What it does |
|------|--------------|
| `001_create_tables.sql` | Creates `profiles`, `training_sessions`, `drill_results`, and `user_stats` tables |
| `002_rls_policies.sql` | Enables Row Level Security so each user can only access their own data |
| `003_triggers.sql` | Auto-creates a profile on signup and auto-updates user stats when a drill result is inserted |

Run each file in the SQL Editor one at a time, in the order listed above.  
Make sure each one completes without errors before running the next.

## 4. Get the API Credentials

1. In the Dashboard, go to **Project Settings** (gear icon in the left sidebar).
2. Click **API**.
3. Copy the following values:
   - **Project URL** — looks like `https://abcdefghij.supabase.co`
   - **anon / public key** — a long `eyJ...` string

## 5. Create the Environment File

In the project root (`gto-trainer/`), create a file called `.env.local`:

```
VITE_SUPABASE_URL=https://abcdefghij.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Replace the values with your actual Project URL and anon key.

> **Note:** `.env.local` is git-ignored by default in Vite projects.  
> Never commit your keys to a public repository.

## 6. Enable the Email Auth Provider

1. In the Dashboard, go to **Authentication** → **Providers**.
2. Find **Email** and make sure it is **enabled** (it is on by default).
3. For development, you may want to **disable** "Confirm email" so sign-up does not require email verification:
   - Go to **Authentication** → **Email Templates** or **Settings**.
   - Toggle **Confirm email** off (or leave it on if you want verification in production).

## 7. Run the App

```bash
npm run dev
```

Sign up with any email/password. The app will create an auth user and a corresponding row in the `profiles` table automatically.

---

## Optional: Disable Email Confirmation for Local Development

If you left email confirmation enabled, new sign-ups will need to verify their email.  
To skip this during development:

1. Go to **Authentication** → **Providers** → **Email**.
2. Toggle off **Confirm email**.

Alternatively, you can check the Supabase **Inbox** (Authentication → Users → click a user) to manually confirm users.

---

## Database Schema Overview

```
auth.users          ← managed by Supabase Auth
   │
   ▼ (trigger: on_auth_user_created)
profiles            ← id, display_name, timestamps
   │
   ├── training_sessions   ← scenario type, params, accuracy
   ├── drill_results       ← individual hand results
   └── user_stats          ← pre-aggregated streaks and accuracy
```

All tables have Row Level Security enabled — users can only read and write their own rows.
