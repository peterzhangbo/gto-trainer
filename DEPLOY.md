# Deployment Guide

## Prerequisites

- Node.js 20+
- A GitHub account
- A Vercel account (free tier is sufficient)

## Step 1: Initialize Git Repository

```bash
cd gto-trainer
git init
git add .
git commit -m "Initial commit"
```

## Step 2: Create GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. Name the repository (e.g. `gto-trainer`)
3. Set it to **Private** if desired
4. Do **not** initialize with a README or .gitignore (the project already has them)
5. Click **Create repository**

## Step 3: Push Code to GitHub

```bash
git remote add origin https://github.com/<your-username>/gto-trainer.git
git branch -M main
git push -u origin main
```

## Step 4: Connect Vercel to GitHub

1. Go to [vercel.com](https://vercel.com)
2. Click **Sign Up** and choose **Continue with GitHub**
3. Authorize Vercel to access your repositories

## Step 5: Import the Repository

1. On the Vercel dashboard click **Add New > Project**
2. Find `gto-trainer` in the repository list and click **Import**
3. Vercel will auto-detect Vite — leave all build settings at their defaults:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

## Step 6: Configure Environment Variables

Before deploying, add the following environment variables in the Vercel project settings (Settings > Environment Variables):

| Variable                  | Description                            |
|---------------------------|----------------------------------------|
| `VITE_SUPABASE_URL`       | Your Supabase project URL              |
| `VITE_SUPABASE_ANON_KEY`  | Your Supabase anonymous/public API key |

You can find these values in your Supabase dashboard under **Settings > API**.

## Step 7: Deploy

1. Click **Deploy**
2. Wait for the build to finish (usually 1-2 minutes)
3. Vercel will provide a URL like `gto-trainer-xxxxx.vercel.app`

Every push to `main` will trigger an automatic redeployment.

## Step 8: Custom Domain (Optional)

1. Go to your project on Vercel
2. Open **Settings > Domains**
3. Enter your domain name and follow the DNS instructions
4. SSL is provisioned automatically

## CI Pipeline

A GitHub Actions workflow (`.github/workflows/deploy.yml`) runs on every push to `main` and pull request. It performs:

- ESLint check
- TypeScript type check
- Unit tests (Vitest)
- Production build

Actual deployment is handled by Vercel's GitHub integration and does not depend on this workflow.
