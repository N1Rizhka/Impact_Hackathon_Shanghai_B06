# Brain Aid

Lifelong learning rooms with friends — custom topics, nudges, chat, pair streaks.

## Local

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Deploy on Vercel

1. Import this project in Vercel (root directory: `brain-aid-demo` if monorepo).
2. **Add Upstash Redis** (Storage → Upstash) so invites/chat sync across computers.
3. Redeploy.

Without Redis, the app still runs with a local file/memory store (fine on one machine; unreliable across Vercel serverless instances).

## One user per computer

The first profile on a browser is locked to that device ID in `localStorage`.

## Invite flow

1. Create a room → copy invite code or `/join/CODE`
2. Friend opens the link → claims their device profile → joins
3. Learn, chat, nudge, build pair streaks by completing sessions the same day

## Custom topics

Topics → paste or upload study material → generates flashcards, error hunt, quiz, explain-back.
