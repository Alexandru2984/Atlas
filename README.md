# Atlas of Living Mythologies

Interactive mythology graph built with Astro + Svelte + Cytoscape.

## MVP Features

- Local-first mythology graph from seed data
- Node exploration panel (type, era, summary, linked threads)
- Add node form (Supabase-backed)
- Add thread form (Supabase-backed)
- Type filter, era filter, and text search on graph
- Responsive layout for desktop and mobile
- Optional Supabase Free integration through env variables

## Tech Stack

- Astro (app shell)
- Svelte (interactive graph component)
- Cytoscape.js (network visualization)
- Supabase JS client (optional persistence layer)

## Run Locally

1. Install dependencies:

```sh
npm install
```

2. Optional: configure Supabase Free project:

```sh
cp .env.example .env
```

Then fill `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` in `.env`.

3. Start dev server:

```sh
npm run dev
```

## Useful Commands

- `npm run dev` - local development
- `npm run build` - production build
- `npm run preview` - preview built app
- `npm run test` - run tests in watch mode
- `npm run test:run` - run tests once
- `npm run test:coverage` - run tests with coverage report

## Testing

Test suite includes:

- Atlas utility unit tests (filters, search behavior, id generation, linked edges)
- Seed data integrity tests (uniqueness, references, weight/type constraints)
- Supabase schema safety tests (tables, RLS, grants, policies, seed blocks)

Run quick validation before pushing:

```sh
npm run test:run && npm run build
```

## Next Steps

- Add edit and delete actions for nodes and edges
- Add graph zoom-to-selection and keyboard navigation
- Add role-based write access with authenticated users
