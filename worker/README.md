# EchoV4ult site chat — backend Worker

Tiny Cloudflare Worker that powers the website's AI qualifier. It holds the
Anthropic API key (as a secret) and proxies chat requests to Claude.

## Deploy (one time)

```bash
cd worker
npm i -g wrangler        # if you don't already have it
wrangler login           # opens browser, log into Cloudflare (free account is fine)
wrangler secret put ANTHROPIC_API_KEY   # paste your Anthropic API key when prompted
wrangler deploy
```

`wrangler deploy` prints a URL like:

```
https://echov4ult-chat.<your-subdomain>.workers.dev
```

Copy that URL into `index.html` — find `CHAT_ENDPOINT` near the bottom and replace
the placeholder. Commit & push. The chat bubble appears automatically once the
endpoint is a real URL.

## Free stopgap (no API cost) — local Ollama via tunnel

Until the paid API is funded, the chat can run on your local Ollama through
mission-control instead of this Worker. Endpoint already exists:
`POST /api/site-chat` on `localhost:3001` (see server.js).

1. Make sure mission-control + Ollama are running (`pm2 list`).
2. Expose it with a free Cloudflare quick tunnel:
   ```bash
   brew install cloudflared        # if needed
   cloudflared tunnel --url http://localhost:3001
   ```
   It prints a URL like `https://random-words.trycloudflare.com`.
3. In `index.html`, set:
   `CHAT_ENDPOINT='https://random-words.trycloudflare.com/api/site-chat'`
   then commit & push.

Caveats: your machine must stay on, the quick-tunnel URL changes each restart
(re-paste it), and local replies are a notch less polished than Claude. Good
enough to launch; switch to the paid Worker below when budget allows.

## Notes
- Model: `claude-haiku-4-5` (cheap + fast; change `MODEL` in `worker.js` to swap).
- Only `echov4ult.com`, `www.echov4ult.com`, and `localhost:4321` may call it
  (see `ALLOWED_ORIGINS`).
- The system prompt (the assistant's personality + the three offerings) lives in
  `worker.js` as `SYSTEM_PROMPT`. Edit there, then `wrangler deploy` again.
- Your API key is never in the website or this repo — it lives only as a Worker
  secret in Cloudflare.
