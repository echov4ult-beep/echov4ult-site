# Affiliate playbook — echov4ult.com

Repo-internal doc (not served). Ritual + snippets for affiliate links. Compliance
pack source: ATTICUS review 2026-08-05 (CLEAR-WITH-EDITS; privacy page amended same day).

## Per-post disclosure block

Paste directly under the post's `post-meta` line, BEFORE any body content, in any
post that contains at least one affiliate link:

```html
<p class="affiliate-note"><strong>Heads up:</strong> some links in this post are
affiliate links — if you buy through one, we earn a small commission at no extra
cost to you. We only link tools we actually use.
<a href="/disclosure/">Full disclosure &rarr;</a></p>
```

## Link rules

- Every affiliate `<a>` gets `rel="sponsored noopener"` (Google spam policy).
- Non-Amazon programs: route through `/go/<tool>/` (same pattern as go/demo —
  noindex meta, JS+meta refresh, GoatCounter pixel, NOT in sitemap.xml).
  Skim the program's ToS for redirect bans before wiring.
- **Amazon: NEVER through /go/.** Raw tagged amazon.com URL only, and the page
  (or sitewide footer) must carry: "As an Amazon Associate we earn from
  qualifying purchases."
- No affiliate links in the Beehiiv newsletter unless the program explicitly
  allows email placement (Amazon does not).

## Go-live checklist (per link)

1. Top-of-post disclosure block present, before first affiliate link
2. `/disclosure/` live + footer-linked (done 2026-08-05)
3. Privacy page affiliate bullet present (done 2026-08-05)
4. `rel="sponsored noopener"` on the link
5. Program ToS skimmed for redirect/cloaking + disclosure rules
6. /go/ redirect noindex + out of sitemap
7. Recommendation honest — tool actually used/vetted, no unverifiable claims
8. Owner publishes (git push = Owner-gated)

## Program shortlist (RADAR briefing 2026-08-05)

Tier 1 (apply first — recurring, small-site friendly):
- Taskade — 50% lifetime recurring — partners.taskade.com
- n8n — 30% x 12mo — n8n.io/affiliates (EUR 100 payout floor, no paid ads)
- Readwise — 33%/sub — docs.readwise.io/affiliates
- DigitalOcean — $25 CPA, 90-day cookie — digitalocean.com/affiliates

Tier 2 (apply once matching content is live):
- Make.com — 35% x 12mo ($100 + 3 paying users payout gate)
- ElevenLabs — up to 22% x 12mo (PartnerStack)
- Heptabase — 20% lifetime (wants an existing review post first)
- Setapp — $25 one-time (Impact)

Watchlist: Notion (program CLOSED to new affiliates as of 2026-08-05 — RADAR
rechecks quarterly), Pinecone (terms not public).
Dead ends verified: Cursor, Windsurf, Replit, Supabase, Obsidian, Anthropic — no programs.
