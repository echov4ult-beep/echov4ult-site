# ViralLens TikTok Worker

This Cloudflare Worker handles the server-side TikTok OAuth exchange and read-only Display API calls for `https://echov4ult.com/virallens/`.

Required secrets:

- `TIKTOK_CLIENT_KEY`
- `TIKTOK_CLIENT_SECRET`
- `SESSION_SECRET` (long random value)

The Worker route is `echov4ult.com/api/virallens/*`. TikTok's registered web redirect URI must be exactly:

`https://echov4ult.com/api/virallens/oauth/callback`

Deploy from this directory with Wrangler after authenticating to the Cloudflare account that controls `echov4ult.com`.
