const statusBox = document.querySelector('#status');
const actions = document.querySelector('#connect-actions');
const results = document.querySelector('#results');
const grid = document.querySelector('#video-grid');
const empty = document.querySelector('#empty-state');
const consoleState = document.querySelector('#console-state');

const compactNumber = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

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
  body.append(title, created, metrics);
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

loadSession();
