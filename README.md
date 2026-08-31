# Keeper League Manager

A tool for managing a fantasy football keeper league year to year: tracks keeper eligibility and
escalating draft-round cost per player, lets each manager privately submit their own keeper picks,
and keeps picks hidden from other managers until you finalize your own.

See the [full design plan](../../../../Users/Daddy%20Pinero/.claude/plans/cheerful-weaving-petal.md)
for the complete rule set, schema, and phased build order.

## Local development

```
npm install
npm run dev
npm test
```

## Build & deploy

Pushing to `main` builds the app and deploys it to GitHub Pages automatically (see
`.github/workflows/deploy.yml`). The site will be available at
`https://<your-github-username>.github.io/fantasy_football_keeper/`.

## Status

Phase 0 (scaffold) in progress. See the plan doc for the full phase breakdown.
