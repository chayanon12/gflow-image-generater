// Background service worker — Google Flow Image Generator

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(console.error);

// Enable side panel only on Google Flow pages
function checkAndSetPanel(tabId, url) {
  if (!url) return;
  try {
    const u = new URL(url);
    const isFlow = u.hostname === 'labs.google' && u.pathname.includes('/tools/flow');
    chrome.sidePanel.setOptions({ tabId, path: 'sidepanel.html', enabled: isFlow });
  } catch {}
}

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === 'complete' || info.url) {
    checkAndSetPanel(tabId, tab.url);
  }
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => checkAndSetPanel(tabId, tab?.url));
});

// Message relay: content.js ↔ sidepanel.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (['GENERATION_STATUS', 'IMAGE_GENERATED'].includes(message.type)) {
    chrome.runtime.sendMessage(message).catch(() => {});
  }
  sendResponse({ received: true });
  return true;
});
