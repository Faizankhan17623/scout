# Scout

A multi-turn agent that reaches out to live tools when it needs current
information. Ask a question, and Scout (running on Groq's free-tier LLM API)
decides whether to answer directly or call a tool first: search the live web,
check the weather, look something up on Wikipedia, read a specific page in
full, generate an image, explain a GitHub repository from its URL, or run a
code snippet in a real sandbox — then streams back an answer with a trace of
what it did. Voice in and voice out are also supported, along with an
optional deep research mode, file attachments, message editing, and
syntax-highlighted code blocks with a one-click copy button.

## Architecture

```
Scout/
├── backend/     Node.js + Express API, MongoDB storage, Groq LLM + tool integrations
└── frontend/    React (Vite) PWA — chat UI with draggable sidebar, streaming replies
```

**Flow:** the frontend streams the user's prompt to the backend over SSE →
the backend asks the Groq LLM to respond → if the LLM calls a tool (web
search, weather, image generation, Wikipedia lookup, full-page read, GitHub
repo explainer, or code execution), the backend executes it and feeds the
result back to the LLM → the LLM produces
a final answer, streamed token-by-token to the frontend → the full
conversation (including which tools were called and their results, plus a
few suggested follow-up questions) is saved to MongoDB under a per-browser
session token, so a returning visitor sees their own conversation history
with no login required.

## Other features

- **Deep research mode** — a toggle in the composer that tells the agent to
  run multiple complementary `web_search` calls, follow up with `read_page`
  on the best results, and produce a structured, multi-section report
  instead of a short answer (up to 10 tool-call rounds instead of the
  usual 5).
- **File attachments** — upload a PDF, `.txt`, `.md`, or `.csv` file
  (parsed server-side, extracted text capped at 12,000 characters) and ask
  questions about it; retrieval tools are automatically disabled for that
  turn so the model answers from the attached content instead of searching.
- **Message editing** — edit a previous message to branch the conversation
  from that point, discarding everything after it and regenerating the
  reply.
- **Follow-up suggestions** — after each reply, 2-3 suggested follow-up
  questions are generated and shown for one-click asking.
- **Syntax-highlighted code blocks** — any code the assistant writes renders
  in a highlighted, language-labeled block with a one-click **Copy** button,
  the same way ChatGPT/Claude present code (via `react-syntax-highlighter`).

## Tools available to the agent

| Tool | What it does | Provider | API key required? |
|---|---|---|---|
| `web_search` | Live web search | [Tavily](https://tavily.com) | Yes (free tier) |
| `get_weather` | Current conditions + 3-day forecast for a location | [Open-Meteo](https://open-meteo.com) | No |
| `generate_image` | Text-to-image generation | [Pollinations.ai](https://pollinations.ai) | No |
| `wikipedia_lookup` | Encyclopedic summary of a topic | [Wikipedia REST API](https://en.wikipedia.org/api/rest_v1/) | No |
| `read_page` | Fetches the full text content of a specific URL | [Jina AI Reader](https://jina.ai/reader) | Optional (raises rate limit) |
| `explain_github_repo` | Fetches a GitHub repo's metadata, README, file tree, and key source files, then explains its purpose and architecture — falls back to reading source files directly when there's no README | [GitHub REST API](https://docs.github.com/en/rest) | Optional (raises rate limit) |
| `run_code` | Executes a code snippet in a real sandbox (Python, JavaScript, Go, Java, C/C++, C#, Ruby, Rust, PHP, Bash, TypeScript) and returns actual stdout/stderr | [Judge0 CE](https://ce.judge0.com) | No |
| Voice input (STT) | Transcribes a recorded voice message into the composer | Groq Whisper (`whisper-large-v3-turbo`) | Uses existing `GROQ_API_KEY` |
| Voice output (TTS) | "Listen" button reads an assistant reply aloud | Groq Orpheus (`canopylabs/orpheus-v1-english`) | Uses existing `GROQ_API_KEY` — see note below |

All non-voice tools were chosen specifically because they're free or have a
genuinely usable free tier — see **Free-tier limitations** below before
relying on this in production.

## Prerequisites

- Node.js 18+
- MongoDB (local instance or a connection string to a hosted cluster, e.g. MongoDB Atlas)
- A [Groq](https://console.groq.com/keys) API key (free tier)
- A [Tavily](https://app.tavily.com) API key (free tier)
- Optionally, a [Jina AI](https://jina.ai/reader) API key (free tier — raises the `read_page` rate limit)

## Backend setup

```bash
cd backend
npm install
cp .env.example .env   # then fill in real values
npm run dev             # starts on http://localhost:5000
```

### Backend environment variables (`backend/.env`)

| Variable | Description |
|---|---|
| `PORT` | Port the API listens on (default `5000`) |
| `GROQ_API_KEY` | Your Groq API key — powers chat, weather/image/wiki reasoning, and voice STT/TTS |
| `GROQ_MODEL` | Groq model name (default `openai/gpt-oss-120b`) |
| `TAVILY_API_KEY` | Your Tavily API key |
| `JINA_API_KEY` | **Optional.** Jina AI Reader key. Leave blank to use the keyless tier (20 req/min instead of 500 req/min) |
| `GITHUB_TOKEN` | **Optional.** GitHub personal access token. Leave blank to use the keyless tier (60 req/hour instead of 5,000 req/hour) |
| `MONGODB_URI` | MongoDB connection string |
| `CORS_ORIGIN` | Allowed frontend origin (default `http://localhost:5173`) |

**One manual step for voice output:** Groq requires accepting the Orpheus
model's terms before the TTS endpoint will work. Do this once at
[console.groq.com/playground?model=canopylabs%2Forpheus-v1-english](https://console.groq.com/playground?model=canopylabs%2Forpheus-v1-english).
Voice input (transcription) needs no such step.

## Frontend setup

```bash
cd frontend
npm install
cp .env.example .env   # adjust VITE_API_URL if backend runs elsewhere
npm run dev             # starts on http://localhost:5173
```

### Frontend environment variables (`frontend/.env`)

| Variable | Description |
|---|---|
| `VITE_API_URL` | Base URL of the backend API (default `http://localhost:5000/api`) |

The frontend is also a PWA (installable on mobile home screens) and its
sidebar width is drag-resizable and persisted per-browser.

## API

All `/api/conversations*` endpoints require an `X-Session-Token` header — a
random per-browser token the frontend generates and persists in
`localStorage` (30-day sliding expiry). It scopes conversations to that
browser with no login; there is no cross-device sync. Requests to
`POST /api/conversations` without the header are rejected with 400, and
`GET /api/conversations` returns an empty list without one.

### `POST /api/conversations` — start a new conversation (SSE stream)

Request:
```json
{ "message": "What's the weather in Lahore right now?", "deepResearch": false }
```

`deepResearch` is optional (default `false`); set it to `true` to enable
[deep research mode](#other-features) for this turn.

Streams `token` events as the reply is generated, then a final `done` event
with the saved conversation:
```
event: token
data: {"token":"The"}

event: done
data: { "conversation": { "_id": "...", "title": "...", "messages": [ ... ] } }
```

Each assistant message includes `searches` (web_search results/images),
`toolCalls` (results from the other tools, each shaped as
`{ tool, args, kind, data, images }`), and `followUps` (2-3 suggested
follow-up questions).

### `POST /api/conversations/:id/messages` — continue a conversation

Same request/response shape as above, appended to an existing conversation.

### `PUT /api/conversations/:id/messages/:index` — edit a message

Request: `{ "message": "..." }` (no `deepResearch` support). `:index` must
point at an existing user message; that message and everything after it in
the conversation are replaced with the edited message and a freshly
generated reply — i.e. this branches the conversation from that point.
Same SSE response shape as the two endpoints above.

### `GET /api/conversations` — list conversations

Returns only conversations belonging to the caller's session token.

### `GET /api/conversations/:id` — fetch one conversation

### `DELETE /api/conversations/:id` — delete a conversation

### `POST /api/files/extract` — extract text from an uploaded file

Multipart form upload, field name `file`. Accepts PDF, `.txt`, `.md`, and
`.csv` (max 10 MB). Returns
`{ "filename": "...", "content": "...", "truncated": false }` — extracted
text is capped at 12,000 characters. The frontend appends the returned
content to the next chat message as an "Attached file" section, and the
backend disables web-search-style tools for that turn so the model answers
from the attachment instead of searching.

### `POST /api/voice/transcribe` — speech-to-text

Multipart form upload, field name `audio` (max 25 MB). Returns
`{ "text": "..." }`.

### `POST /api/voice/speak` — text-to-speech

Request: `{ "text": "...", "voice": "troy" }` (`voice` optional, defaults to
`"troy"`). Returns raw `audio/wav` bytes.

### `GET /api/health`

Simple liveness check, returns `{ "status": "ok" }`.

## Admin dashboard

A password-protected admin dashboard is available at a private, unlisted
frontend route — the path is intentionally **not documented here** since
this repo is public; it lives only in the `VITE_ADMIN_PATH` environment
variable (frontend `.env`, not committed). It shows total users, a visit
log with IP addresses, a per-IP breakdown, and conversation/message
volume, backed by a small set of `/api/admin/*` endpoints protected by a
JWT-based login (`POST /api/admin/login`, `requireAdmin` middleware).

To create or reset the admin login, run against the target database:

```bash
node backend/scripts/seedAdmin.js <email> <password>
```

Required backend env vars: `JWT_SECRET` (random secret used to sign admin
session tokens) and `ADMIN_TOKEN_TTL` (session length, defaults to `7d`).
See `backend/.env.example` and `frontend/.env.example` for the full list.

## Free-tier limitations

Everything this project talks to runs on a free plan. These limits are
accurate as of when each integration was added — **verify current limits on
the provider's site before depending on this in production**, since free
tiers change often (Tavily's own quota, and Groq's own rate limits, are the
two most likely to shift).

| Provider | Free-tier limit | Notes |
|---|---|---|
| **Groq** (LLM + Whisper + Orpheus) | Model-dependent; Whisper: 20 req/min, 2,000 req/day. Chat model limits vary by model. | No credit card required. Orpheus TTS needs a one-time terms acceptance in the console (see above) or it returns HTTP 400. |
| **Tavily** (`web_search`) | ~1,000 searches/month | No credit card required for signup. |
| **Open-Meteo** (`get_weather`) | 10,000 calls/day, 300,000/month, no API key at all | The most generous integration in this project — genuinely free with no account. |
| **Pollinations.ai** (`generate_image`) | ~1 request per 15s anonymously (community-observed, not officially documented); faster with a free account | No API key required. Image generation can take several seconds; occasional slow or failed generations are expected on the free tier. |
| **Wikipedia REST API** (`wikipedia_lookup`) | No hard limit; a descriptive `User-Agent` header is required by Wikimedia's usage policy | No API key. |
| **Jina AI Reader** (`read_page`) | 20 requests/min with no key; 500 requests/min **and a fixed 10,000,000-token lifetime allowance** with a free key | The 10M tokens are a one-time allowance, not a recurring monthly quota — once spent, that key stops working entirely and needs replacing. Page content is truncated to 6,000 characters before being sent to the LLM to keep the context window reasonable. When the key is exhausted or invalid, `read_page` returns a clear error explaining this instead of a raw HTTP failure. |
| **GitHub REST API** (`explain_github_repo`) | 60 requests/hour per IP with no token; 5,000 requests/hour with a personal access token | No signup needed for the keyless tier. README and key source files are each truncated to 6,000 characters, and the file tree to 300 entries, before being sent to the LLM. |
| **Judge0 CE** (`run_code`) | Public community instance, no API key, but shared and unauthenticated — no published hard quota and no uptime SLA | Code runs in an isolated sandbox on Judge0's infrastructure, not on this project's server. Output is capped at 4,000 characters per stream, and requests time out after 20 seconds. Not suitable for production-critical use given the lack of an SLA. |

Because every tool sits on a shared free plan, **heavy concurrent use will
hit rate limits** — the agent has a retry-once fallback for the case where
Groq returns an empty completion, but sustained 429s from any provider will
surface as a "Failed to get a response from the agent" error in the UI.

## Running locally end-to-end

1. Start MongoDB (or point `MONGODB_URI` at a hosted instance, e.g. MongoDB Atlas).
2. Fill in real `GROQ_API_KEY` and `TAVILY_API_KEY` values in `backend/.env` (optionally `JINA_API_KEY`).
3. Accept the Orpheus model terms in the Groq console if you want voice output.
4. `npm run dev` in `backend/`.
5. `npm run dev` in `frontend/`.
6. Open the frontend URL, type (or record) a prompt, hit Send.

## Deploying to production

Test the full flow locally with real API keys first. Once verified:
- Deploy `backend/` to your Node host of choice (Vercel Functions, Render, Railway, etc.), with the env vars above set in that platform's dashboard.
- Deploy `frontend/` as a static/Vite build, with `VITE_API_URL` pointed at the deployed backend URL.
- Re-check each provider's current free-tier limits before going live with real traffic — they are not contractual and can change without notice.
