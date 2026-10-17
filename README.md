# Convico backend

Minimal Next.js App Router API for Convico text and voice chat. `POST /api/chat` accepts `{message,history,requestId}`. `POST /api/voice` accepts multipart `audio`, `durationSeconds`, `history` (JSON), and `requestId`. Both return `{reply}` or `{error:{code,message,retryAfterSeconds?}}`.

## Setup

1. Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey). Copy `.env.example` to `.env.local` and enter the key. Keep it on the server; never put it in the Expo app or a `NEXT_PUBLIC_` variable.
2. Create an Upstash Redis database and set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. This shared store is required: AI requests fail closed without it. It tracks IP rate limits, a shared application budget, one active request per IP, request IDs, and a provider-quota circuit breaker.
3. Install dependencies with `npm install`. For local development use `npm run dev`.
4. Import this GitHub repository in Vercel as a Next.js project. Set `GEMINI_API_KEY`, `GEMINI_MODEL`, and both Upstash variables in Project Settings → Environment Variables. Set the limit variables there if different from defaults. Redeploy after environment changes.
5. In the Expo app, set `EXPO_PUBLIC_API_BASE_URL=https://your-backend.vercel.app` in its local environment or build configuration. For a physical phone during local development use the computer's reachable LAN IP (for example `http://192.168.1.10:3000`), not `localhost`.

## Limits and security

Default application controls: 5 requests per IP per rolling hour; 50 daily requests with an 80% safety threshold (40 accepted requests) across the app; one concurrent request per IP; 2,000 message characters; 10 history entries; 3 MB audio and 120 seconds duration. Change them centrally through `LIMIT_*` environment variables. A unique request ID is consumed before calling Gemini, so a repeated request cannot generate twice. Rejected requests never call Gemini. There are no automatic retries or model switches.

The app has no login. IP limits can affect people sharing a public IP, and IP identity depends on Vercel's trusted proxy headers. Keep deployment behind Vercel and add verified user authentication before public release if per-user quotas are needed. CORS is optional via comma-separated `APP_ALLOWED_ORIGINS` for browsers and is not authentication. Requests without an Origin header are accepted for native clients. Do not place a shared secret in the mobile bundle.

The daily counter is an application safety budget, not Google's actual remaining quota. It rolls over 24 hours after its first accepted request. Google's model limits vary by model, account, and tier; check [your active limits](https://ai.google.dev/gemini-api/docs/rate-limits) in AI Studio. After a provider quota response, `convico:provider-quota` remains set in Redis. Once you have confirmed quota is available in AI Studio, manually delete that key to resume requests. The backend does not guess Google's reset time. `GEMINI_MODEL` defaults to `gemini-2.5-flash` and must support both text and audio.

Vercel Functions currently cap request and response payloads at 4.5 MB. This backend caps audio at 3 MB to leave multipart overhead and uses a 45-second function duration. Check [Vercel's current function limits](https://vercel.com/docs/functions/limitations) for your plan; provider latency and other account limits can still cause failures. Audio duration is supplied by the app and checked, while byte size and MIME type are checked server-side. A production service needing a hard audio-duration guarantee should inspect audio metadata with a suitable parser.

No secrets belong in Git history. `.env.local` and other `.env` files are ignored; `.env.example` contains placeholders only.
