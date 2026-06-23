/**
 * EchoV4ult site chat — Cloudflare Worker
 *
 * A small backend for the website's AI qualifier. It holds the Anthropic API key
 * (as a Worker secret, never in the browser), talks to Claude, and returns a reply.
 *
 * The assistant's job: ask 2–3 questions, recommend the right EchoV4ult offering,
 * and funnel the visitor to the booking form. It is NOT an open-ended chatbot.
 *
 * Deploy:
 *   cd worker
 *   npm i -g wrangler            # if you don't have it
 *   wrangler login
 *   wrangler secret put ANTHROPIC_API_KEY   # paste your key when prompted
 *   wrangler deploy
 * Then copy the printed *.workers.dev URL into index.html (CHAT_ENDPOINT).
 */

const MODEL = 'claude-haiku-4-5';
const MAX_TOKENS = 400;

// Only these origins may call the Worker.
const ALLOWED_ORIGINS = [
  'https://echov4ult.com',
  'https://www.echov4ult.com',
  'http://localhost:4321', // local preview
];

const SYSTEM_PROMPT = `You are the friendly AI concierge on echov4ult.com, the website of EchoV4ult — Chris Retherford's AI implementation business that helps small businesses put AI to work.

Your ONE job: in a few quick, warm questions, understand the visitor's business and biggest time-sink, then recommend which EchoV4ult offering fits and nudge them to book a free intro call.

THE THREE OFFERINGS:
1. Claude Skills — from $99. Ready-made or custom "skills" that teach AI to do one specific job (e.g. write product descriptions, answer FAQs) in the business's own voice. Best for a narrow, repeatable task.
2. Hermes / OpenClaw setup — from $1,500 one-time. A full done-for-you AI agent workspace: a crew of agents installed, tuned, and connected to the business's tools, with team training. Best when they want AI handling several jobs, not just one.
3. Ongoing management — monthly retainer (custom quote). Monitoring, tuning, and adding new automations over time. Best as an add-on for businesses that want it maintained and growing.

HOW TO BEHAVE:
- Be concise, warm, and plain-English. No jargon, no hype. Short messages (2–4 sentences).
- Ask ONE question at a time. Start by asking what kind of business they run and what eats most of their time.
- After 2–3 exchanges, recommend the best-fit offering and explain why in one line.
- Always end a recommendation by pointing them to the booking form: "Scroll down to the booking form (or hit 'Book a call' up top) and mention this — Chris replies within one business day."
- If they ask about price, give the ranges above honestly. Exact scope is set on the call.
- Never invent features, timelines, guarantees, or client names. If unsure, say the call is the best place to dig in.
- Stay on topic. If asked something unrelated to AI for their business, gently steer back, or suggest they email echov4ult@gmail.com.
- You are not Chris; you're his site assistant. Don't promise to personally do work — Chris does the work.`;

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin);

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: cors });
    }

    let body;
    try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400, cors); }

    let messages = Array.isArray(body.messages) ? body.messages : null;
    if (!messages || !messages.length) return json({ error: 'no messages' }, 400, cors);

    // Keep it cheap and abuse-resistant: last 12 turns, trimmed content.
    messages = messages.slice(-12).map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || '').slice(0, 2000),
    }));

    if (!env.ANTHROPIC_API_KEY) return json({ error: 'server not configured' }, 500, cors);

    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: SYSTEM_PROMPT,
          messages,
        }),
      });
      if (!r.ok) {
        const t = await r.text();
        return json({ error: 'upstream', detail: t.slice(0, 300) }, 502, cors);
      }
      const data = await r.json();
      const reply = (data.content || []).map(b => b.text || '').join('').trim();
      return json({ reply: reply || "Sorry — I didn't catch that. Could you rephrase?" }, 200, cors);
    } catch (e) {
      return json({ error: 'fetch failed', detail: String(e).slice(0, 200) }, 502, cors);
    }
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json', ...cors },
  });
}
