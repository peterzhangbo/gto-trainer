# GTO Trainer

A Game Theory Optimal (GTO) training platform for Texas Hold'em poker. Practice optimal strategies, study hand ranges, and analyze expected value in a modern, interactive interface.

## Features

- **GTO Hand Trainer** -- Practice GTO decisions across preflop and postflop scenarios with instant feedback on your plays
- **Range Viewer** -- Visualize and study preflop hand ranges for every position and action
- **EV Calculator** -- Calculate expected value of actions in any spot to sharpen your decision-making
- **User Dashboard** -- Track your progress, review session history, and monitor improvement over time

## Tech Stack

- **Framework:** React 19 + TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS v4
- **State Management:** Zustand
- **Routing:** React Router v7
- **Charts:** Recharts
- **Backend / Auth:** Supabase
- **Hand Evaluation:** pokersolver

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`.

### Other Commands

```bash
npm run build    # Production build
npm run preview  # Preview production build locally
npm run lint     # Run ESLint
npx vitest run   # Run tests
```

## Environment Variables

Create a `.env.local` file in the project root with your Supabase credentials:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

See `.env.example` for the expected format.

## Deployment

See [DEPLOY.md](./DEPLOY.md) for a full step-by-step guide to deploying on Vercel.

## Screenshots

<!-- Add screenshots here -->
