/**
 * WebClaw Background Service Worker (Manifest V3)
 * Handles privileged browser operations: tab control, sidepanel, messaging.
 */

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('WebClaw Background received:', request);

  switch (request.type) {
    case 'EXT_TAB_LIST':
      chrome.tabs.query({}, (tabs) => {
        const list = tabs.map(t => ({
          id: t.id,
          title: t.title,
          url: t.url,
          active: t.active,
          windowId: t.windowId
        }));
        sendResponse({ success: true, data: list });
      });
      return true; // async response

    case 'EXT_TAB_FOCUS':
      chrome.tabs.update(request.tabId, { active: true }, (tab) => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          chrome.windows.update(tab.windowId, { focused: true });
          sendResponse({ success: true });
        }
      });
      return true;

    case 'EXT_TAB_OPEN':
      chrome.tabs.create({ url: request.url }, (tab) => {
        sendResponse({ success: true, tabId: tab.id });
      });
      return true;

    case 'EXT_TAB_CLOSE':
      chrome.tabs.remove(request.tabId, () => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true });
        }
      });
      return true;

    case 'EXT_TAB_RELOAD':
      chrome.tabs.reload(request.tabId, { bypassCache: true }, () => {
        sendResponse({ success: true });
      });
      return true;

    case 'EXT_SEARCH':
      chrome.search.query({ text: request.query }, () => {
        sendResponse({ success: true });
      });
      return true;

    default:
      sendResponse({ success: false, error: 'Unknown command type: ' + request.type });
  }
});
