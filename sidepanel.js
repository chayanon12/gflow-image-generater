/**
 * sidepanel.js — Google Flow Image Generator Side Panel
 * Handles: Queue, History, Settings, Chrome messaging
 */

// ========================================
// STATE
// ========================================
const state = {
  queue: [],
  history: [],
  isRunning: false,
  isPaused: false,
  currentIndex: -1,
  settings: {
    delay: 5,
    maxQueue: 200,
    loop: false,
    autoScroll: true,
    autoDownload: true,
    flowUrl: '',
    betweenMin: 2,
    betweenMax: 5,
    mediaType: 'Image',
    model: 'Auto',
    quantity: 'x1'
  }
};

// ========================================
// DOM REFS
// ========================================
const $ = (id) => document.getElementById(id);

const tabBtns  = document.querySelectorAll('.tab-btn');
const tabPanels = { generate: $('panel-generate'), queue: $('panel-queue'), history: $('panel-history') };

// Generate Tab
const promptInput    = $('prompt-input');
const charCount      = $('char-count');
const delaySeconds   = $('delay-seconds');
const repeatCount    = $('repeat-count');
const betweenDelay   = $('between-delay');
const modeSelect     = $('mode-select');
const btnAddQueue    = $('btn-add-queue');
const btnGo          = $('btn-go');
const btnGoLabel     = $('btn-go-label');
const btnClearPrompt = $('btn-clear-prompt');
const btnUseTemplate = $('btn-use-template');
const toggleLoop     = $('toggle-loop');
const toggleScroll   = $('toggle-scroll');
const toggleDownload = $('toggle-download');
const selectMediaType = $('select-media-type');
const selectModel     = $('select-model');
const selectQuantity  = $('select-quantity');
const bulkLineCount  = $('bulk-line-count');
const bulkHint       = $('bulk-hint');
const optSingle      = $('opt-single');
const optBulk        = $('opt-bulk');

// Status
const statusDot   = $('status-dot');
const statusText  = $('status-text');
const statusBadge = $('status-badge');

// Queue Tab
const queueList   = $('queue-list');
const queueEmpty  = $('queue-empty');
const statTotal   = $('stat-total');
const statDone    = $('stat-done');
const statPending = $('stat-pending');
const progressFill = $('progress-fill');
const progressText = $('progress-text');
const btnPause     = $('btn-pause');
const btnClearQueue = $('btn-clear-queue');
const btnStartQueue = $('btn-start-queue');
const queueCount   = $('queue-count');

// History Tab
const historyList   = $('history-list');
const historyEmpty  = $('history-empty');
const historySearch = $('history-search');
const historyCount  = $('history-count');
const btnClearHistory = $('btn-clear-history');

// Settings
const settingsModal     = $('settings-modal');
const btnSettings       = $('btn-settings');
const btnCloseSettings  = $('btn-close-settings');
const btnCancelSettings = $('btn-cancel-settings');
const btnSaveSettings   = $('btn-save-settings');
const settingDelay      = $('setting-delay');
const settingMaxQueue   = $('setting-max-queue');
const settingFlowUrl    = $('setting-flow-url');

const toast = $('toast');

// ========================================
// INIT
// ========================================
function init() {
  loadFromStorage();
  bindEvents();
  renderQueueList();
  renderHistoryList();
  updateQueueStats();
  updateStatus('idle', 'Ready to generate');
  updateQueueBadge();
}

// ========================================
// STORAGE
// ========================================
function loadFromStorage() {
  try {
    const q = localStorage.getItem('gflowgen_queue');
    const h = localStorage.getItem('gflowgen_history');
    const s = localStorage.getItem('gflowgen_settings');
    if (q) state.queue = JSON.parse(q);
    if (h) state.history = JSON.parse(h);
    if (s) Object.assign(state.settings, JSON.parse(s));

    delaySeconds.value   = state.settings.delay || 5;
    toggleLoop.checked   = state.settings.loop;
    toggleScroll.checked = state.settings.autoScroll;
    
    // Safety check in case toggleDownload is missing in DOM somehow
    if (toggleDownload) {
      toggleDownload.checked = state.settings.autoDownload !== false;
    }
    
    settingDelay.value   = state.settings.delay || 5;
    settingMaxQueue.value = state.settings.maxQueue || 200;
    settingFlowUrl.value  = state.settings.flowUrl || '';

    if (betweenDelay) betweenDelay.value = state.settings.betweenMin || 3;
    if (modeSelect)   modeSelect.value   = state.settings.mode || 'single';

    if (selectMediaType) {
      selectMediaType.value = state.settings.mediaType || 'Image';
      selectModel.value = state.settings.model || 'Auto';
      selectQuantity.value = state.settings.quantity || 'x1';
    }

    updateMode();
  } catch (e) {
    console.error('GFlowGen: Storage error', e);
  }
}

function saveQueue()    { localStorage.setItem('gflowgen_queue', JSON.stringify(state.queue)); }
function saveHistory()  { localStorage.setItem('gflowgen_history', JSON.stringify(state.history)); }
function saveSettings() { localStorage.setItem('gflowgen_settings', JSON.stringify(state.settings)); }

// ========================================
// TAB SWITCHING
// ========================================
function switchTab(tabName) {
  tabBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));
  Object.entries(tabPanels).forEach(([name, panel]) => {
    panel.classList.toggle('active', name === tabName);
  });
}

// ========================================
// STATUS
// ========================================
function updateStatus(type, text, badge) {
  statusDot.className = 'status-dot ' + type;
  statusText.textContent = text;
  statusBadge.textContent = badge || type.toUpperCase();
}

// ========================================
// QUEUE MANAGEMENT
// ========================================

function injectOptions(text) {
  return text; 
}

function addToQueue(rawPrompt, repeat) {
  if (!rawPrompt.trim()) { showToast('Please enter a prompt', 'error'); return false; }
  if (state.queue.length >= state.settings.maxQueue) {
    showToast(`Queue full (max ${state.settings.maxQueue})`, 'error'); return false;
  }
  
  const prompt = rawPrompt.trim();
  const times = repeat || parseInt(repeatCount.value) || 1;
  let added = 0;
  for (let i = 0; i < times; i++) {
    state.queue.push({
      id: Date.now() + Math.random(),
      prompt: prompt,
      mediaType: selectMediaType ? selectMediaType.value : 'Image',
      modelName: selectModel ? selectModel.value : 'Auto',
      quantity: selectQuantity ? selectQuantity.value : 'x1',
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    added++;
    if (state.queue.length >= state.settings.maxQueue) break;
  }
  saveQueue();
  renderQueueList();
  updateQueueStats();
  updateQueueBadge();
  return added;
}

function removeFromQueue(id) {
  state.queue = state.queue.filter(i => i.id != id);
  saveQueue(); renderQueueList(); updateQueueStats(); updateQueueBadge();
}

function clearQueue() {
  if (!confirm('Clear all queue items?')) return;
  state.queue = []; state.isRunning = false; state.isPaused = false;
  saveQueue(); renderQueueList(); updateQueueStats(); updateQueueBadge();
  updateStatus('idle', 'Ready to generate');
  showToast('Queue cleared');
}

function updateQueueStats() {
  const total   = state.queue.length;
  const done    = state.queue.filter(i => i.status === 'done').length;
  const pending = state.queue.filter(i => i.status === 'pending').length;
  statTotal.textContent   = total;
  statDone.textContent    = done;
  statPending.textContent = pending;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  progressFill.style.width = pct + '%';
  progressText.textContent = `${done} / ${total}`;
}

function updateQueueBadge() {
  const pending = state.queue.filter(i => i.status === 'pending').length;
  queueCount.textContent = pending;
  queueCount.style.display = pending > 0 ? 'inline-flex' : 'none';
}

function renderQueueList() {
  queueEmpty.style.display = state.queue.length === 0 ? 'flex' : 'none';
  Array.from(queueList.children).forEach(c => { if (c !== queueEmpty) c.remove(); });
  state.queue.forEach((item, idx) => {
    const el = document.createElement('div');
    el.className = `queue-item ${item.status}`;
    el.innerHTML = `
      <span class="queue-item-num">${idx + 1}</span>
      <div class="queue-item-content">
        <div class="queue-item-prompt" title="${escHtml(item.prompt)}">${escHtml(item.prompt)}</div>
        <div class="queue-item-meta">
          <span class="queue-item-tag">${formatDate(item.createdAt)}</span>
          <span class="queue-item-status ${item.status}">${item.status}</span>
        </div>
      </div>
      <div class="queue-item-actions">
        <button class="icon-btn small" data-action="reprompt" data-id="${item.id}" title="Load prompt">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
        <button class="icon-btn small" data-action="remove" data-id="${item.id}" title="Remove">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
            <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>`;
    queueList.appendChild(el);
  });
}

// ========================================
// HISTORY
// ========================================
function addToHistory(prompt) {
  state.history.unshift({ id: Date.now(), prompt, generatedAt: new Date().toISOString() });
  if (state.history.length > 100) state.history.pop();
  saveHistory(); renderHistoryList();
}

function clearHistory() {
  if (!confirm('Clear all history?')) return;
  state.history = []; saveHistory(); renderHistoryList(); showToast('History cleared');
}

function renderHistoryList(filter = '') {
  const items = filter
    ? state.history.filter(i => i.prompt.toLowerCase().includes(filter.toLowerCase()))
    : state.history;
  historyEmpty.style.display = items.length === 0 ? 'flex' : 'none';
  historyCount.textContent = `${state.history.length} prompt${state.history.length !== 1 ? 's' : ''} generated`;
  Array.from(historyList.children).forEach(c => { if (c !== historyEmpty) c.remove(); });
  items.forEach(item => {
    const el = document.createElement('div');
    el.className = 'history-item';
    el.innerHTML = `
      <div class="history-item-prompt">${escHtml(item.prompt)}</div>
      <div class="history-item-footer">
        <span class="history-item-time">${formatDate(item.generatedAt)}</span>
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="history-item-count">✓ generated</span>
          <div class="history-item-actions">
            <button class="icon-btn small" data-action="reuse" data-prompt="${escHtml(item.prompt)}" title="Use prompt">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <polyline points="1 4 1 10 7 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <path d="M3.51 15a9 9 0 1 0 .49-3.37" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
            <button class="icon-btn small" data-action="addqueue" data-prompt="${escHtml(item.prompt)}" title="Add to queue">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>`;
    historyList.appendChild(el);
  });
}

// ========================================
// QUEUE RUNNER (sends to content.js)
// ========================================
function findFlowTab(callback) {
  const savedUrl = state.settings.flowUrl;

  chrome.tabs.query({}, (tabs) => {
    // 1. Prefer saved URL
    if (savedUrl) {
      const saved = tabs.find(t => t.url?.startsWith(savedUrl));
      if (saved) { callback(saved); return; }
    }
    // 2. Any open Flow project tab
    const flowTab = tabs.find(t => t.url?.includes('labs.google') && t.url?.includes('/tools/flow'));
    if (flowTab) { callback(flowTab); return; }
    // 3. Open a new tab to Flow
    callback(null);
  });
}

function startQueue() {
  const pending = state.queue.filter(i => i.status === 'pending');
  if (pending.length === 0) { showToast('No pending prompts', 'error'); return; }

  state.isRunning = true;
  state.isPaused  = false;
  updateStatus('running', `Processing queue (${pending.length} prompts)...`, 'RUNNING');
  updatePauseBtn();

  findFlowTab((tab) => {
    if (!tab) {
      showToast('Open a Google Flow project tab first!', 'error');
      state.isRunning = false;
      updateStatus('idle', 'Open labs.google/fx/*/tools/flow/... first');
      return;
    }

    // Bring the tab to focus
    chrome.tabs.update(tab.id, { active: true });

    chrome.tabs.sendMessage(tab.id, {
      type: 'START_QUEUE',
      queue: pending,
      delay:      parseInt(delaySeconds.value) || state.settings.delay || 5,
      betweenMin: parseInt(betweenDelay?.value) || state.settings.betweenMin || 3,
      betweenMax: parseInt(betweenDelay?.value) || state.settings.betweenMax || 5,
      autoDownload: state.settings.autoDownload !== false
    }).catch(() => {
      showToast('Cannot connect — reload the Flow tab', 'error');
      state.isRunning = false;
      updateStatus('idle', 'Reload the Flow tab and try again');
    });
  });
}

/**
 * BULK GENERATE ALL — read from unified promptInput (bulk mode), fire immediately.
 */
function bulkGoNow() {
  const lines = promptInput.value.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (!lines.length) { showToast('Enter at least one prompt', 'error'); return; }
  if (lines.length > 200) { showToast('Max 200 prompts at once', 'error'); return; }

  const genDelay   = parseInt(delaySeconds.value) || state.settings.delay || 5;
  const between    = parseInt(betweenDelay?.value) || 3;

  // Build queue items
  const ephQueue = lines.map((l, i) => ({
    id: Date.now() + i,
    prompt: l.trim(),
    mediaType: selectMediaType ? selectMediaType.value : 'Image',
    modelName: selectModel ? selectModel.value : 'Auto',
    quantity: selectQuantity ? selectQuantity.value : 'x1',
    status: 'pending',
    createdAt: new Date().toISOString()
  }));

  // Add to persistent queue
  ephQueue.forEach(item => state.queue.push(item));
  saveQueue();
  renderQueueList();
  updateQueueStats();
  updateQueueBadge();

  state.isRunning = true;
  state.isPaused  = false;
  updateStatus('running', `Bulk: ${lines.length} prompts 🚀`, 'RUNNING');
  updatePauseBtn();
  switchTab('queue');

  findFlowTab((tab) => {
    if (!tab) {
      showToast('Open a Google Flow project tab first!', 'error');
      state.isRunning = false;
      updateStatus('idle', 'Open labs.google/fx/*/tools/flow/... first');
      return;
    }
    chrome.tabs.update(tab.id, { active: true });
    chrome.tabs.sendMessage(tab.id, {
      type: 'START_QUEUE',
      queue: ephQueue,
      delay:      genDelay,
      betweenMin: between,
      betweenMax: between + 3,   // slight randomness: between ~ between+3s
      autoDownload: state.settings.autoDownload !== false
    }).catch(() => {
      showToast('Cannot connect — reload the Flow tab', 'error');
      state.isRunning = false;
      updateStatus('idle', 'Reload the Flow tab and try again');
    });
  });

  showToast(`🚀 Starting ${lines.length} bulk generations!`, 'success');
}

function generateNow() {
  const rawPrompt = promptInput.value.trim();
  if (!rawPrompt) { showToast('Please enter a prompt', 'error'); return; }

  const prompt = rawPrompt;

  // Grab the currently selected options
  const mediaType = selectMediaType ? selectMediaType.value : 'Image';
  const modelName = selectModel ? selectModel.value : 'Auto';
  const quantity = selectQuantity ? selectQuantity.value : 'x1';

  findFlowTab((tab) => {
    if (!tab) {
      showToast('Open a Google Flow project tab first!', 'error');
      return;
    }
    chrome.tabs.update(tab.id, { active: true });
    chrome.tabs.sendMessage(tab.id, {
      type: 'GENERATE_SINGLE',
      prompt,
      mediaType,
      modelName,
      quantity,
      delay: parseInt(delaySeconds.value) || 5,
      autoDownload: state.settings.autoDownload !== false
    }).catch(() => showToast('Cannot connect — reload the Flow tab', 'error'));
  });

  addToHistory(prompt);
  showToast('Generation started! 🚀', 'success');
  updateStatus('running', `Generating: "${prompt.slice(0, 30)}${prompt.length > 30 ? '...' : ''}"`, 'RUNNING');
}

function togglePause() {
  state.isPaused = !state.isPaused;
  findFlowTab((tab) => {
    if (tab) chrome.tabs.sendMessage(tab.id, { type: state.isPaused ? 'PAUSE_QUEUE' : 'RESUME_QUEUE' }).catch(() => {});
  });
  updatePauseBtn();
  updateStatus(state.isPaused ? 'paused' : 'running', state.isPaused ? 'Queue paused' : 'Resuming...', state.isPaused ? 'PAUSED' : 'RUNNING');
}

function updatePauseBtn() {
  const icon = $('pause-icon');
  icon.innerHTML = state.isPaused
    ? `<polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/>`
    : `<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>`;
}

// ========================================
// HELPERS
// ========================================
function rePrompt(id) {
  const item = state.queue.find(i => String(i.id) === String(id));
  if (item) {
    if (selectMediaType) selectMediaType.value = item.mediaType || 'Image';
    if (selectModel) selectModel.value = item.modelName || 'Auto';
    if (selectQuantity) selectQuantity.value = item.quantity || '1';
    
    promptInput.value = item.prompt; 
    switchTab('generate'); 
    updateCharCount(); 
  }
}

function reUsePrompt(promptText) {
  promptInput.value = promptText; 
  switchTab('generate'); 
  updateCharCount();
  showToast('Prompt loaded', 'success');
}

function addHistoryToQueue(prompt) {
  addToQueue(prompt, 1); 
  showToast('Added to queue', 'success');
}

function updateCharCount() {
  const len = promptInput.value.length;
  charCount.textContent = `${len} / 2000`;
  charCount.style.color = len > 1800 ? 'var(--danger)' : len > 1500 ? 'var(--warning)' : 'var(--text-muted)';
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(iso) {
  const d = new Date(iso), now = new Date(), diff = now - d;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
}

function showToast(msg, type = '') {
  toast.textContent = msg;
  toast.className = `toast show ${type}`;
  setTimeout(() => { toast.className = 'toast'; }, 2800);
}

// ========================================
// TEMPLATES (Google Flow style)
// ========================================
const TEMPLATES = [
  'A photorealistic {subject} in golden hour light, shallow depth of field, 8K',
  'Abstract digital art of {concept}, vibrant neon colors, geometric shapes',
  'Cinematic close-up of {subject}, dramatic lighting, film grain',
  'Watercolor painting of {scene}, soft brushstrokes, pastel tones, dreamy',
  '{subject} in the style of a Studio Ghibli film, lush backgrounds, magic realism',
  'Macro photography of {object}, bokeh background, studio lighting',
  'Futuristic city of {place}, holographic displays, rain-slicked streets, cyberpunk'
];

function useTemplate() {
  const t = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
  promptInput.value = t; updateCharCount(); promptInput.focus();
  promptInput.setSelectionRange(0, t.length);
}

// ========================================
// EVENT BINDINGS
// ========================================
function bindEvents() {
  tabBtns.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

  // Mode dropdown
  if (modeSelect) modeSelect.addEventListener('change', () => updateMode());

  promptInput.addEventListener('input', () => {
    const isBulk = modeSelect?.value === 'bulk';
    if (isBulk) {
      const count = getLinesCount();
      if (bulkLineCount) {
        bulkLineCount.textContent = `${count} prompts`;
        bulkLineCount.style.color = count > 200 ? 'var(--danger)' : count > 100 ? 'var(--warning)' : 'var(--text-muted)';
      }
      charCount.textContent = count + ' prompts';
    } else {
      charCount.textContent = promptInput.value.length + '';
      updateCharCount();
    }
  });

  btnClearPrompt.addEventListener('click', () => { promptInput.value = ''; updateMode(); });
  btnUseTemplate.addEventListener('click', useTemplate);

  $('inc-delay').addEventListener('click', () => { delaySeconds.value = Math.min(120, +delaySeconds.value + 1); });
  $('dec-delay').addEventListener('click', () => { delaySeconds.value = Math.max(3,   +delaySeconds.value - 1); });
  $('inc-repeat').addEventListener('click', () => { repeatCount.value  = Math.min(10,  +repeatCount.value  + 1); });
  $('dec-repeat').addEventListener('click', () => { repeatCount.value  = Math.max(1,   +repeatCount.value  - 1); });
  $('inc-between').addEventListener('click', () => { betweenDelay.value = Math.min(60,  +betweenDelay.value + 1); });
  $('dec-between').addEventListener('click', () => { betweenDelay.value = Math.max(1,   +betweenDelay.value - 1); });

  toggleLoop.addEventListener('change', () => { state.settings.loop = toggleLoop.checked; saveSettings(); });
  toggleScroll.addEventListener('change', () => { state.settings.autoScroll = toggleScroll.checked; saveSettings(); });
  if (toggleDownload) {
    toggleDownload.addEventListener('change', () => { state.settings.autoDownload = toggleDownload.checked; saveSettings(); });
  }

  [selectMediaType, selectModel, selectQuantity].forEach(el => {
    if (el) el.addEventListener('change', () => {
      state.settings.mediaType = selectMediaType.value;
      state.settings.model = selectModel.value;
      state.settings.quantity = selectQuantity.value;
      saveSettings();
    });
  });

  btnAddQueue.addEventListener('click', () => {
    const isBulk = modeSelect?.value === 'bulk';
    if (isBulk) {
      const lines = promptInput.value.split('\n').filter(l => l.trim());
      if (!lines.length) { showToast('Enter at least one prompt', 'error'); return; }
      let added = 0;
      for (const l of lines) { if (addToQueue(l, 1)) added++; else break; }
      if (added) { showToast(`Added ${added} prompts to queue`, 'success'); switchTab('queue'); }
    } else {
      const added = addToQueue(promptInput.value);
      if (added) { showToast(`Added ${added} item(s) to queue`, 'success'); switchTab('queue'); }
    }
  });

  // Unified Go button — single or bulk
  if (btnGo) btnGo.addEventListener('click', () => {
    const isBulk = modeSelect?.value === 'bulk';
    if (isBulk) {
      bulkGoNow();
    } else {
      generateNow();
    }
  });

  btnStartQueue.addEventListener('click', startQueue);
  btnPause.addEventListener('click', togglePause);
  btnClearQueue.addEventListener('click', clearQueue);

  // Queue List delegation
  queueList.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if (action === 'remove') {
      removeFromQueue(id);
    } else if (action === 'reprompt') {
      rePrompt(id);
    }
  });

  // History List delegation
  historyList.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const promptText = btn.dataset.prompt;
    if (action === 'reuse') {
      reUsePrompt(promptText);
    } else if (action === 'addqueue') {
      addHistoryToQueue(promptText);
    }
  });

  historySearch.addEventListener('input', () => renderHistoryList(historySearch.value));
  btnClearHistory.addEventListener('click', clearHistory);

  btnSettings.addEventListener('click', () => {
    settingDelay.value    = state.settings.delay;
    settingMaxQueue.value = state.settings.maxQueue;
    settingFlowUrl.value  = state.settings.flowUrl || '';
    settingsModal.classList.add('open');
  });

  [btnCloseSettings, btnCancelSettings].forEach(b => b.addEventListener('click', () => settingsModal.classList.remove('open')));
  settingsModal.addEventListener('click', e => { if (e.target === settingsModal) settingsModal.classList.remove('open'); });

  btnSaveSettings.addEventListener('click', () => {
    state.settings.delay    = parseInt(settingDelay.value) || 5;
    state.settings.maxQueue = parseInt(settingMaxQueue.value) || 200;
    state.settings.flowUrl  = settingFlowUrl.value.trim();
    delaySeconds.value = state.settings.delay;
    saveSettings();
    settingsModal.classList.remove('open');
    showToast('Settings saved', 'success');
  });

  // Listen for events from content.js
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'GENERATION_STATUS') handleStatus(msg);
    if (msg.type === 'IMAGE_GENERATED') showToast('Image generated ✓', 'success');
    if (msg.type === 'DOWNLOAD_IMAGE' && msg.url) {
      const filename = `flow_${Date.now()}_${Math.floor(Math.random()*1000)}.jpg`;
      chrome.downloads.download({
        url: msg.url,
        filename: filename,
        saveAs: false
      }).catch(err => console.error('Download failed:', err));
    }
  });
}

// ========================================
// MODE SWITCHING
// ========================================
function updateMode() {
  const isBulk = modeSelect?.value === 'bulk';

  // Textarea placeholder
  promptInput.placeholder = isBulk
    ? 'One prompt per line:\n\nA golden retriever at sunset\nCyberpunk city street at night\nAbstract geometric art in gold\n...'
    : 'Describe what you want to create...\n\ne.g. A photorealistic golden retriever puppy in autumn leaves';

  // Resize textarea taller in bulk mode
  promptInput.rows = isBulk ? 8 : 5;

  // Show/hide elements
  bulkHint?.classList.toggle('hidden', !isBulk);
  bulkLineCount?.classList.toggle('hidden', !isBulk);
  optSingle?.classList.toggle('hidden', isBulk);
  optBulk?.classList.toggle('hidden', !isBulk);

  // Update footer char count label
  charCount.textContent = isBulk
    ? getLinesCount() + ' prompts'
    : promptInput.value.length + '';

  // Update action button label
  if (btnGoLabel) btnGoLabel.textContent = isBulk ? 'Bulk Generate All' : 'Generate Now';
  if (btnGo) {
    btnGo.className = isBulk ? 'btn-go bulk' : 'btn-go';
  }

  state.settings.mode = isBulk ? 'bulk' : 'single';
  saveSettings();
}

function getLinesCount() {
  return promptInput.value.split('\n').filter(l => l.trim()).length;
}

function handleStatus(msg) {
  const { itemId, status, current, total } = msg;
  const item = state.queue.find(i => i.id == itemId);
  if (item) { item.status = status; saveQueue(); renderQueueList(); updateQueueStats(); }
  if (status === 'done' && item) addToHistory(item.prompt);
  if (status === 'running') updateStatus('running', `Generating ${current}/${total}...`, 'RUNNING');
  if (status === 'queue_complete') {
    state.isRunning = false;
    updateStatus('idle', '🎉 All done! Queue complete.', 'DONE');
    showToast('Queue complete! 🎉', 'success');
  }
}

// ========================================
// START
// ========================================
init();
