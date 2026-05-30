# AI Trend → Carousel — Session Save (May 29, 2026)

## Status
- **Groq integration** — backend server built with Express
- `GET /api/news` — fetches from NewsAPI
- `POST /api/summarize` — sends to Groq (llama3-70b-8192) for AI summary
- Frontend wired to backend — mock data replaced with real API calls
- Craftly theme applied (dark/light, streaks, fonts, cards, buttons)
- 3 tabs: Discover → Summary → Carousel

## What's left to do

### 1. Add API keys
- `backend/.env` needs your **NewsAPI key** (https://newsapi.org/register) and **Groq API key** (https://console.groq.com/keys)

### 2. Run the project
- Start backend: `cd backend && npm start`
- Open `index.html` in browser (or serve with `npx serve .`)

### 3. Future ideas
- Deploy backend to a server (Railway, Render, etc.)
- Add search/filter for news topics
- More carousel layout options

## Files
- `/Users/karameyad/Desktop/carousel/index.html` — frontend
- `/Users/karameyad/Desktop/carousel/backend/` — Express server
  - `server.js` — routes for NewsAPI + Groq
  - `.env` — API keys (fill in)
  - `package.json` — dependencies

## API Keys Needed
- NewsAPI: https://newsapi.org/register
- Groq: https://console.groq.com/keys
