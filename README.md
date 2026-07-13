# Scout

A web-search agent. You type a prompt, Scout (powered by Groq's free-tier LLM
API) decides if it needs current information, searches the live web via
Tavily, and returns an answer with a trace of what it looked up.

## Architecture

```
Scout/
├── backend/     Node.js + Express API, MongoDB storage, Groq LLM + Tavily integration
└── frontend/    React (Vite) single-page UI — prompt in, response out
```

**Flow:** frontend sends the user's prompt to `POST /api/chat` → backend asks
the LLM to respond → if the LLM requests a web search (via tool calling), the
backend calls the Tavily API, feeds the results back to the LLM → the LLM
produces a final answer → the prompt, response, and any searches performed
are saved to MongoDB and returned to the frontend.

Both the LLM and search provider are configured to use their free tiers by
default (Groq's `llama-3.1-8b-instant` model, Tavily's basic search).

## Prerequisites

- Node.js 18+
- MongoDB (local instance or a connection string to a hosted cluster, e.g. MongoDB Atlas)
- A [Groq](https://console.groq.com/keys) API key (free tier)
- A [Tavily](https://app.tavily.com) API key (free tier)

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
| `GROQ_API_KEY` | Your Groq API key |
| `GROQ_MODEL` | Groq model name (default `llama-3.1-8b-instant`, free tier) |
| `TAVILY_API_KEY` | Your Tavily API key |
| `MONGODB_URI` | MongoDB connection string |
| `CORS_ORIGIN` | Allowed frontend origin (default `http://localhost:5173`) |

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

## API

### `POST /api/chat`

Request:
```json
{ "prompt": "What's the latest news on the James Webb telescope?" }
```

Response:
```json
{
  "id": "...",
  "response": "...",
  "searches": [
    { "query": "James Webb telescope latest news", "results": [ { "title": "...", "url": "...", "content": "..." } ] }
  ]
}
```

### `GET /api/health`

Simple liveness check, returns `{ "status": "ok" }`.

## Running locally end-to-end

1. Start MongoDB (or point `MONGODB_URI` at a hosted instance, e.g. MongoDB Atlas).
2. Fill in real `GROQ_API_KEY` and `TAVILY_API_KEY` values in `backend/.env`.
3. `npm run dev` in `backend/`.
4. `npm run dev` in `frontend/`.
5. Open the frontend URL, type a prompt, hit Send.

## Deploying to production

Test the full flow locally with real API keys first. Once verified:
- Deploy `backend/` to your Node host of choice (Vercel Functions, Render, Railway, etc.), with the env vars above set in that platform's dashboard.
- Deploy `frontend/` as a static/Vite build, with `VITE_API_URL` pointed at the deployed backend URL.
