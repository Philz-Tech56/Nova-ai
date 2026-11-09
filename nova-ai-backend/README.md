# Nova AI

**Your AI. Your World.**

Nova AI is being built as an Android-first AI assistant with secure accounts, chat history, and future VIP plans.

## Current repository contents

- `backend/server.js`: Express API with Supabase session verification and OpenAI chat.
- `supabase/schema.sql`: conversation and message tables with Row Level Security.
- `.env.example`: names of required server environment variables (placeholders only).

## Backend setup

1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Fill in real values in the server's private environment. Never commit `.env`.
5. In Supabase SQL Editor, run `supabase/schema.sql`.
6. Start locally with `npm run dev`.

## Required server environment variables

- `SUPABASE_URL`: your Supabase project URL.
- `SUPABASE_SECRET_KEY`: server-only Supabase secret key. Never place this in an Android app or GitHub.
- `OPENAI_API_KEY`: server-only OpenAI API key.
- `OPENAI_MODEL`: optional model name; defaults to `gpt-4.1-mini`.
- `FRONTEND_ORIGIN`: allowed frontend origin(s), comma-separated.
- `PORT`: optional server port.

## API

- `GET /api/health`: basic health check.
- `POST /api/chat`: requires `Authorization: Bearer <Supabase access token>` and JSON `{ "message": "Hello", "conversationId": null }`.

This is a backend foundation, not a deployed service or complete Android app. Android UI integration, account screens, production hosting, billing, and end-to-end tests remain to be completed.
