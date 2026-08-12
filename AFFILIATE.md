# Affiliate playbook — echov4ult.com

Repo-internal doc (not served). Ritual + snippets for affiliate links. Compliance
pack source: ATTICUS review 2026-08-05 (CLEAR-WITH-EDITS; privacy page amended same day).

## Per-post disclosure block

Paste directly under the post's `post-meta` line, BEFORE any body content, in any
post that contains at least one affiliate link:

```html
<p class="affiliate-note"><strong>Heads up:</strong> we earn commissions when you
shop through the links below — at no extra cost to you. We only link tools we
actually use or have vetted.
<a href="/disclosure/">Full disclosure &rarr;</a></p>
```

(v2 2026-08-11: leads with DigitalOcean/Awin's REQUIRED exact sentence "we earn
commissions when you shop through the links below" — their affiliate manager's
condition for turning commissions on. Old "some links in this post" block retired;
pending ATTICUS confirm — ties into the queued ATTICUS task on disclosure injection.)

## DigitalOcean/Awin channel disclosure matrix (Adam @ DO, email 2026-08-11 — BINDING for DO links)

- **Blog/webpages:** "we earn commissions when you shop through the links below"
  at the beginning of the post / top of page (covered by block v2 above).
- **Video (YouTube/podcast/etc.):** VERBAL disclosure at the start, before first
  brand mention: "We have relationships with some of the brands featured in this
  video, and when you shop through the links in the description we'll earn a
  commission at no additional cost to you." PLUS in the description: the sentence
  before the first affiliate link, OR "(ad)" before each link.
- **Social posts:** must START with "(ad)" or "#ad" — not after the pitch, not
  buried in hashtags.
- **Social video (Shorts/TikTok):** "#advertisement" burned across the bottom of
  the video FROM THE START, plus "(ad)"/"#ad" at the beginning of the caption text.
- **Ebooks/manuals/guides (⚠️ applies to Gumroad kits if DO links ever go in):**
  "When you use the services featured in this guide, we earn a referral fee at no
  additional cost to you." on the TOC and on the page with the links.
- **Emails:** "Through my partnership with DigitalOcean, I earn a referral fee at
  no additional cost to you" before the link + BCC affiliates@digitalocean.com.
  (House rule stands: no affiliate links in Beehiiv — so this applies only if we
  ever deliberately change that for DO.)
- **Client work (Echov4ult Web relevance):** if we ever deploy client sites on DO,
  the client contract must conspicuously disclose vendor referral fees; send a copy
  of the general contract to DO.

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
  ACCEPTED 2026-08-05, setup in progress (Erin @ partnerships; slug echov4ult,
  v-shield icon, custom bar text). 2026-08-11: Erin couldn't find an account under
  echov4ult@gmail.com (affiliate page attaches to a Readwise account) → Owner
  created the account + replied same day. AWAITING Erin's affiliate-page
  confirmation + final links. /go/readwise/ + /go/reader/ wired provisionally to
  readwise.io/echov4ult landing pages — SWAP URLs when Erin sends final links.
- DigitalOcean — 10% recurring x 12mo, 30-day cookie — **APPROVED 2026-08-11 at 0%
  commission** (Adam @ DO): link live/working now; commissions turn ON once we (a) have
  the channel disclosures in place and (b) email Adam example pages showing them.
  Disclosure matrix codified above; /go/digitalocean/ wired 2026-08-11 (Awin cread
  deep link). First DO post LIVE 2026-08-11: /blog/laptop-vs-vps-for-ai-agents/
  (honest no-usage-claim framing, block v2 verified live). **Example pages EMAILED
  to Adam 2026-08-11 (Owner sent from echov4ult@gmail.com) — AWAITING commissions-on
  confirmation.** When it lands: update this row + confirm tracking with a test click
  in the Awin dashboard. OPEN Owner-hand: Awin payout method (publisher 3022797). ⚠️ Awin payment status was Exposure Level 4
  (2026-08-05) — commissions may pay late; CJ as backup if Awin proves unreliable.

Tier 2 (apply once matching content is live):
- Make.com — 35% x 12mo ($100 + 3 paying users payout gate)
- ElevenLabs — up to 22% x 12mo (PartnerStack)
- Heptabase — 20% lifetime (wants an existing review post first)
- Setapp — $25 one-time (Impact)

Watchlist: Notion (program CLOSED to new affiliates as of 2026-08-05 — RADAR
rechecks quarterly), Pinecone (terms not public).
Dead ends verified: Cursor, Windsurf, Replit, Supabase, Obsidian, Anthropic — no programs.
