const statusBox = document.querySelector('#status');
const actions = document.querySelector('#connect-actions');
const results = document.querySelector('#results');
const grid = document.querySelector('#video-grid');
const empty = document.querySelector('#empty-state');
const consoleState = document.querySelector('#console-state');

const compactNumber = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

// House laws: loaded from /virallens/laws.json, with Law 1 inlined as a fallback so grading never silently disappears.
const FALLBACK_LAWS = [{
  id: 'seven-zero-opener',
  number: 1,
  title: 'Open with the Seven / Zero question',
  rule: 'Every video opens with the question: "What if Seven and Zero swapped teams?"',
  why: 'The old videos that pulled the highest view counts all started with this exact question. It is the proven hook, so it is the default opener until the numbers say otherwise.',
  pattern: '^what\\s+if\\s+(seven|7)\\s+(and|&|\\+)\\s+(zero|0)\\s+(swap|swaps|swapped|switch|switches|switched|trade|trades|traded)\\s+teams'
}];
let laws = FALLBACK_LAWS;

async function loadLaws() {
  try {
    const response = await fetch('/virallens/laws.json', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('laws.json unavailable');
    const payload = await response.json();
    if (Array.isArray(payload.laws) && payload.laws.length) laws = payload.laws;
  } catch { laws = FALLBACK_LAWS; }
  renderLaws();
}

function renderLaws() {
  const list = document.querySelector('#law-list');
  if (!list) return;
  list.replaceChildren(...laws.map(law => {
    const item = document.createElement('li');
    item.className = 'vl-law';
    const number = document.createElement('span');
    number.className = 'vl-law-number';
    number.textContent = `Law ${String(law.number).padStart(2, '0')}`;
    const body = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = law.title;
    const rule = document.createElement('p');
    rule.className = 'vl-law-rule';
    rule.textContent = law.rule;
    const why = document.createElement('p');
    why.textContent = law.why;
    body.append(title, rule, why);
    item.append(number, body);
    return item;
  }));
}

// Strip leading emoji, hashtags, quotes, and punctuation so only real words are graded.
function normalizeOpener(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[\u2018\u2019\u201c\u201d"']/g, '')
    .replace(/^(?:[^a-z0-9#]+|#\S+\s*)+/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function lawPasses(law, video) {
  let pattern;
  try { pattern = new RegExp(law.pattern, 'i'); } catch { return null; }
  const caption = normalizeOpener(video.title || video.video_description);
  return pattern.test(caption);
}

function lawBadges(video) {
  const wrap = document.createElement('div');
  wrap.className = 'vl-law-badges';
  laws.forEach(law => {
    const result = lawPasses(law, video);
    if (result === null) return;
    const badge = document.createElement('span');
    badge.className = `vl-law-badge ${result ? 'is-pass' : 'is-miss'}`;
    badge.title = law.rule;
    badge.textContent = `Law ${law.number} · ${result ? 'opener present' : 'opener missing'}`;
    wrap.append(badge);
  });
  return wrap;
}

function showStatus(message) {
  statusBox.textContent = message;
  statusBox.hidden = false;
}

function safeText(value, fallback = 'Untitled video') {
  const text = String(value || '').trim();
  return text || fallback;
}

function metric(label, value) {
  const item = document.createElement('span');
  const number = document.createElement('b');
  number.textContent = compactNumber.format(Number(value || 0));
  item.append(number, document.createTextNode(label));
  return item;
}

function videoCard(video) {
  const article = document.createElement('article');
  article.className = 'vl-video';
  const media = document.createElement('div');
  media.className = 'vl-video-media';
  const image = document.createElement('img');
  image.src = video.cover_image_url || '/assets/v-shield.png';
  image.alt = '';
  media.append(image);
  const body = document.createElement('div');
  body.className = 'vl-video-body';
  const title = document.createElement('h3');
  title.textContent = safeText(video.title || video.video_description);
  const created = document.createElement('time');
  created.textContent = video.create_time ? new Date(video.create_time * 1000).toLocaleDateString() : 'Date unavailable';
  const metrics = document.createElement('div');
  metrics.className = 'vl-metrics';
  metrics.append(metric(' views', video.view_count), metric(' likes', video.like_count), metric(' comments', video.comment_count), metric(' shares', video.share_count));
  body.append(title, created, lawBadges(video), metrics);
  article.append(media, body);
  return article;
}

async function loadSession() {
  const params = new URLSearchParams(location.search);
  if (params.get('error')) showStatus(`TikTok connection was not completed: ${params.get('error')}`);
  try {
    const response = await fetch('/api/virallens/session', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if (response.status === 401) return;
    if (!response.ok) throw new Error('TikTok data could not be loaded. Reconnect and try again.');
    const payload = await response.json();
    actions.hidden = true;
    results.hidden = false;
    consoleState.textContent = 'Connected · live data';
    consoleState.style.color = '#3fb950';
    document.querySelector('#profile-name').textContent = safeText(payload.user?.display_name, 'TikTok account');
    document.querySelector('#profile-avatar').src = payload.user?.avatar_url || '/assets/v-shield.png';
    document.querySelector('#observed-at').textContent = `TikTok Display API · observed ${new Date(payload.observed_at).toLocaleString()}`;
    grid.replaceChildren(...(payload.videos || []).map(videoCard));
    empty.hidden = Boolean(payload.videos?.length);
  } catch (error) {
    showStatus(error.message);
  }
}

document.querySelector('#disconnect-button').addEventListener('click', async () => {
  const response = await fetch('/api/virallens/disconnect', { method: 'POST', credentials: 'same-origin' });
  if (response.ok) location.replace('/virallens/?disconnected=1');
  else showStatus('Disconnect failed. Refresh the page and try again.');
});

loadLaws().then(loadSession);
