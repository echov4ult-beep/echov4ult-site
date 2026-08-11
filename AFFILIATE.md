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

LIVE / WIRED:
- Taskade — **20% recurring** (dashboard-verified 2026-08-05; RADAR's "50% lifetime"
  source was wrong) — /go/taskade/ → taskade.com/?via=boj9l1 — signed up, payout
  method still unset (Owner). ToS skimmed: no redirect ban in public terms.

Tier 1 (apply first — recurring, small-site friendly):
- n8n — 30% x 12mo — APPLIED 2026-08-05, pending n8n GmbH review (email lands at
  echov4ult@gmail.com). Runs on PartnerStack — Owner should create the PartnerStack
  account + payment setup while waiting; same PartnerStack account also covers
  ElevenLabs (Tier 2) later.
- Readwise — 33% first year ($22–$40/signup) + 2 free months for referrals —
  ACCEPTED 2026-08-05, setup in progress (Erin @ partnerships replied; reply
  sent with slug echov4ult, v-shield icon, custom bar text). /go/readwise/ +
  /go/reader/ wired to readwise.io/echov4ult landing pages. Update redirect
  URLs if Erin sends different final links.
- DigitalOcean — 10% recurring x 12mo, 30-day cookie — APPLIED 2026-08-05 via Awin
  (publisher ID 3022797, advertiser ID 123996, pending approval). ⚠️ Awin payment
  status is Exposure Level 4 (advertiser over credit limit + past settlement terms) —
  commissions may pay late. Consider applying via CJ as a backup if Awin payouts
  prove unreliable. Wire /go/digitalocean/ once approved.

Tier 2 (apply once matching content is live):
- Make.com — 35% x 12mo ($100 + 3 paying users payout gate)
- ElevenLabs — up to 22% x 12mo (PartnerStack)
- Heptabase — 20% lifetime (wants an existing review post first)
- Setapp — $25 one-time (Impact)

Watchlist: Notion (program CLOSED to new affiliates as of 2026-08-05 — RADAR
rechecks quarterly), Pinecone (terms not public).
Dead ends verified: Cursor, Windsurf, Replit, Supabase, Obsidian, Anthropic — no programs.
