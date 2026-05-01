import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args;
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args));
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args;
    return ipcRenderer.off(channel, ...omit);
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args;
    return ipcRenderer.send(channel, ...omit);
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args;
    return ipcRenderer.invoke(channel, ...omit);
  },
  toggleDevMode(isEnabled: boolean) {
    return ipcRenderer.send("toggle-dev-mode", isEnabled);
  }
});

window.addEventListener('DOMContentLoaded', () => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  Object.defineProperty(navigator, 'languages', { get: () => ['de-DE', 'de', 'en-US', 'en'] });
  Object.defineProperty(navigator, 'platform', { get: () => 'Linux x86_64' });

  if (navigator.plugins.length === 0) {
    const plugins = [
      { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
      { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgieoopi', description: '' },
      { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' }
    ];
    Object.defineProperty(navigator, 'plugins', { get: () => plugins });
  }

  if (window.location.hostname.endsWith('google.com')) {
    autoAcceptCookies();

    if (window.location.hostname === 'gemini.google.com') {
      injectGemiDeskStyles();
      initWordCounter();
    }

    ipcRenderer.on('set-model', (_event, modelName) => {
      preferredModel = (modelName as string).toLowerCase();
      knownRateLimitedModels.clear();
      setExtensionClick(800);
      selectPreferredModel();
    });

    const autoSelectorObserver = new MutationObserver(() => {
      selectPreferredModel();
    });
    autoSelectorObserver.observe(document.body, { childList: true, subtree: true });

    let currentUrl = location.href;
    setInterval(() => {
      if (location.href !== currentUrl) {
        currentUrl = location.href;
        lastKnownModel = null;
        lastTriggerClickTime = 0;
        knownRateLimitedModels.clear();
        scrapeChatHistory(true);
        setTimeout(selectPreferredModel, 500);
      }
    }, 500);

    setInterval(detectAndFixGemError, 1000);

    ipcRenderer.on('bulk-delete', async (_event, urls) => {
      for (const url of (urls as string[])) {
        await deleteChatByUrl(url);
      }
    });

    ipcRenderer.on('prepare-pdf-download', async () => {
      await preparePdfDownload();
      ipcRenderer.send('pdf-ready');
    });

    ipcRenderer.on('cleanup-pdf', () => {
      const style = document.getElementById('pdf-export-style');
      if (style) style.remove();
      window.scrollTo(0, document.body.scrollHeight);
    });

    let scrapeTimeout: ReturnType<typeof setTimeout> | null = null;
    const debouncedScrape = () => {
      if (scrapeTimeout) clearTimeout(scrapeTimeout);
      scrapeTimeout = setTimeout(() => scrapeChatHistory(), 300);
    };
    const chatObserver = new MutationObserver(() => {
      debouncedScrape();
    });

    const observeChats = () => {
      const chatListContainer = document.querySelector(
        '.sidenav-with-history-container, .overflow-container, .chat-history-list, conversations-list, infinite-scroller'
      );
      if (chatListContainer) {
        chatObserver.observe(chatListContainer, { childList: true, subtree: true });
        scrapeChatHistory();
      } else {
        setTimeout(observeChats, 1000);
      }
    };
    observeChats();
    setInterval(() => {
      if (isActiveTab) scrapeChatHistory();
    }, 2000);

    const observeInput = () => {
      const inputArea = document.querySelector('rich-textarea div[contenteditable="true"]');
      if (inputArea) {
        const inputObserver = new MutationObserver(() => {
          if ((inputArea as HTMLElement).innerText.trim() === '') {
            if (scrapeTimeout) clearTimeout(scrapeTimeout);
            scrapeTimeout = setTimeout(() => {
              const activeChatId = extractChatId(location.href);
              (window as any).bumpChatId = activeChatId;
              scrapeChatHistory(true);
            }, 2500);
          }
        });
        inputObserver.observe(inputArea, { childList: true, characterData: true, subtree: true });
      } else {
        setTimeout(observeInput, 2000);
      }
    };
    observeInput();

    const titleObserver = new MutationObserver(() => {
      ipcRenderer.send('chat-title-changed', document.title);
    });
    const titleEl = document.querySelector('title');
    if (titleEl) {
      titleObserver.observe(titleEl, { childList: true });
      ipcRenderer.send('chat-title-changed', document.title);
    }

    let gemScrapeTimeout: ReturnType<typeof setTimeout> | null = null;
    const debouncedGemScrape = () => {
      if (gemScrapeTimeout) clearTimeout(gemScrapeTimeout);
      gemScrapeTimeout = setTimeout(() => scrapeGems(), 2000);
    };
    const gemObserver = new MutationObserver(() => debouncedGemScrape());

    const observeGems = () => {
      const body = document.body;
      if (body) {
        gemObserver.observe(body, { childList: true, subtree: true });
        scrapeGems();
      } else {
        setTimeout(observeGems, 1000);
      }
    };
    observeGems();
    setInterval(scrapeGems, 30000);

    let lastUrl = '';
    const activeGemObserver = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        detectActiveGemIcon();
      }
    });
    activeGemObserver.observe(document.body, { childList: true, subtree: true });
    setInterval(detectActiveGemIcon, 10000);

    ipcRenderer.on('load-more-chats', () => {
      lazyLoadChats();
    });

    ipcRenderer.on('toggle-pin-chat', (_event, url) => {
      const links = Array.from(document.querySelectorAll('a[href*="/app/"]'));
      const link = links.find(l => {
        const href = l.getAttribute('href') || '';
        return href.endsWith(url) || url.endsWith(href);
      });

      if (link) {
        let parent = link.parentElement;
        let menuBtn: HTMLElement | null = null;
        while (parent && parent !== document.body) {
          menuBtn = parent.querySelector('[data-test-id="actions-menu-button"], button.conversation-actions-menu-button, button[aria-haspopup="menu"]');
          if (menuBtn) break;
          parent = parent.parentElement;
        }

        if (menuBtn) {
          menuBtn.click();
          setTimeout(() => {
            const overlay = document.querySelector('.cdk-overlay-container') || document.body;
            const menuItems = Array.from(overlay.querySelectorAll('[role="menuitem"], button, a, span'));
            const pinBtn = menuItems.find(item => {
              if (item === menuBtn) return false;
              const text = (item.textContent || '').toLowerCase();
              const ariaLabel = (item.getAttribute('aria-label') || '').toLowerCase();
              return text.includes('anpinnen') || text.includes('pin') || text.includes('loslösen') || text.includes('unpin') ||
                ariaLabel.includes('anpinnen') || ariaLabel.includes('pin') || ariaLabel.includes('loslösen') || ariaLabel.includes('unpin');
            });

            if (pinBtn) {
              (pinBtn as HTMLElement).click();
            } else {
              const allElements = Array.from(overlay.querySelectorAll('span, div'));
              const fallbackBtn = allElements.find(item => {
                const text = (item.textContent || '').toLowerCase();
                return text.includes('anpinnen') || text.includes('pin') || text.includes('loslösen') || text.includes('unpin');
              });
              if (fallbackBtn) {
                (fallbackBtn as HTMLElement).click();
              }
            }

            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
            document.body.click();

            setTimeout(() => scrapeChatHistory(true), 300);
            setTimeout(() => scrapeChatHistory(true), 1000);
          }, 250);
        }
      }
    });

    ipcRenderer.on('set-theme', (_event, theme) => {
      applyGeminiTheme(theme as string);
    });

    ipcRenderer.invoke('get-store', 'appTheme').then(theme => {
      if (theme) applyGeminiTheme(theme as string);
    });
  }
});

window.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const link = target.closest('a');
  if (!link) return;

  const url = link.getAttribute('href') || '';
  const chatIdMatch = url.match(/\/app\/([a-zA-Z0-9_-]+)/);

  if (chatIdMatch) {
    const chatId = chatIdMatch[1];
    const gemId = getStoredGemId(chatId);

    if (gemId && !url.includes('/gem/')) {
      e.preventDefault();
      e.stopPropagation();
      window.location.href = `https://gemini.google.com/gem/${gemId}/${chatId}?hl=de`;
    }
  }
}, true);

function applyGeminiTheme(theme: string) {
  const isDark = theme === 'dark';
  document.body.classList.toggle('dark-theme', isDark);
  document.body.classList.toggle('light-theme', !isDark);

  try {
    const themeStorage = isDark ? 'dark' : 'light';
    localStorage.setItem('gb_ui_theme', themeStorage);
    localStorage.setItem('theme', themeStorage);
  } catch (e) { }

  if (isDark) {
    document.documentElement.style.setProperty('--gray-900', '#131314');
    document.documentElement.style.setProperty('--surface-0', '#131314');
  } else {
    document.documentElement.style.setProperty('--gray-900', '#ffffff');
    document.documentElement.style.setProperty('--surface-0', '#ffffff');
  }
}

function injectGemiDeskStyles() {
  const style = document.createElement('style');
  style.id = 'gemidesk-core-styles';
  style.textContent = `
    sidebar-container, 
    app-sidebar, 
    .sidenav,
    .sidenav-with-history-container,
    bard-sidenav,
    [class*="bard-sidenav"],
    .my-stuff-side-nav,
    mat-drawer,
    mat-sidenav,
    .mat-drawer-inner-container {
      position: fixed !important;
      left: -5000px !important;
      top: 0 !important;
      height: 100vh !important;
      width: 300px !important;
      display: flex !important;
      visibility: visible !important;
      opacity: 0.001 !important;
      pointer-events: none !important;
      z-index: -9999 !important;
      transform: none !important;
      transition: none !important;
    }
    
    infinite-scroller, 
    .overflow-container,
    .chat-history-list {
      display: flex !important;
      height: 100% !important;
      overflow-y: auto !important;
    }

    button[aria-label*="menü"], 
    button[aria-label*="menu"],
    .hamburger-menu-button {
      display: none !important;
    }

    .mat-sidenav-content, 
    .chat-container, 
    .main-content,
    .conversation-container,
    .page-content {
      margin-left: 0 !important;
      padding-left: 0 !important;
      width: 100% !important;
    }

    #gemidesk-word-counter {
      position: absolute;
      bottom: 10px;
      right: 20px;
      font-size: 12px;
      color: #9aa0a6;
      background: rgba(32, 33, 36, 0.8);
      padding: 4px 8px;
      border-radius: 12px;
      pointer-events: none;
      z-index: 1000;
    }
  `;
  document.head.appendChild(style);
}

function initWordCounter() {
  const observer = new MutationObserver(() => {
    const inputArea = document.querySelector('rich-textarea div[contenteditable="true"]');
    if (inputArea && !document.getElementById('gemidesk-word-counter')) {
      const counter = document.createElement('div');
      counter.id = 'gemidesk-word-counter';
      counter.innerText = '0 words | 0 chars';
      inputArea.parentElement?.parentElement?.appendChild(counter);

      inputArea.addEventListener('input', () => {
        const text = (inputArea as HTMLElement).innerText || '';
        const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
        const chars = text.length;
        counter.innerText = `${words} words | ${chars} chars`;
      });
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

function autoAcceptCookies() {
  const clickAccept = () => {
    const buttons = Array.from(document.querySelectorAll('button, span, div[role="button"]'));
    const acceptBtn = buttons.find(b => {
      const text = (b.textContent || '').toLowerCase();
      return text === 'alle akzeptieren' ||
        text === 'accept all' ||
        text === 'ich stimme zu' ||
        text === 'i agree' ||
        text === 'alle annehmen';
    });

    if (acceptBtn) {
      (acceptBtn as HTMLElement).click();
      return true;
    }
    return false;
  };

  if (!clickAccept()) {
    const observer = new MutationObserver((_mutations, obs) => {
      if (clickAccept()) {
        obs.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(clickAccept, 1000);
    setTimeout(clickAccept, 3000);
  }
}

let preferredModel = "pro";
let lastKnownModel: string | null = null;
let lastTriggerClickTime = 0;
let isExtensionClick = false;
let extensionActionTimeout: NodeJS.Timeout | null = null;
let knownRateLimitedModels = new Set<string>();

const TRIGGER_SELECTOR = ".input-area-switch";
const TRIGGER_LABEL_SELECTOR = ".logo-pill-label-container span";
const MODEL_SELECTORS: Record<string, string> = {
  "pro": "[data-test-id='bard-mode-option-pro']",
  "thinking": "[data-test-id='bard-mode-option-thinking']",
  "fast": "[data-test-id='bard-mode-option-fast']"
};
const MODEL_HIERARCHY_BASE = ["pro", "thinking", "fast"];

function getModelFromText(text: string) {
  text = text.trim().toLowerCase();
  if (text.includes("pro") || text.includes("advanced")) return "pro";
  if (text.includes("thinking")) return "thinking";
  if (text.includes("flash") || text.includes("fast")) return "fast";
  return null;
}

function simulateOptionClick(element: HTMLElement) {
  if (!element) return;
  ["mousedown", "mouseup", "click"].forEach(type => {
    element.dispatchEvent(new MouseEvent(type, {
      bubbles: true, cancelable: true, view: window, composed: true
    }));
  });
}

function setExtensionClick(ms = 800) {
  isExtensionClick = true;
  if (extensionActionTimeout) clearTimeout(extensionActionTimeout);
  extensionActionTimeout = setTimeout(() => { isExtensionClick = false; }, ms);
}

function selectPreferredModel() {
  for (const banner of Array.from(document.querySelectorAll(".disclaimer-container, .promo"))) {
    const text = (banner as HTMLElement).innerText.toLowerCase();
    if (text.includes("limit resets on") || text.includes("responses will use other models") || text.includes("reached your")) {
      knownRateLimitedModels.add("pro");
      break;
    }
  }

  const triggerLabel = document.querySelector(TRIGGER_LABEL_SELECTOR);
  if (triggerLabel) {
    const m = getModelFromText((triggerLabel as HTMLElement).textContent || "");
    if (m) lastKnownModel = m;
  }

  const hierarchyMap: Record<string, string[]> = {
    "thinking": ["thinking", "pro", "fast"],
    "fast": ["fast", "thinking", "pro"],
  };
  const MODEL_HIERARCHY = hierarchyMap[preferredModel] ?? [...MODEL_HIERARCHY_BASE];

  const optionsFound = document.querySelector("[role='menuitemradio'], [role='menuitem']");
  if (optionsFound) {
    if ((window as any)._gemideskSwitcherEvaluatingMenu) return;
    if (!isExtensionClick) return;

    (window as any)._gemideskSwitcherEvaluatingMenu = true;
    setTimeout(() => {
      (window as any)._gemideskSwitcherEvaluatingMenu = false;
      if (!document.querySelector("[role='menuitemradio'], [role='menuitem']")) return;

      for (const modelKey of MODEL_HIERARCHY) {
        let option = document.querySelector(MODEL_SELECTORS[modelKey]);
        if (!option) {
          option = Array.from(document.querySelectorAll("[role='menuitemradio'], [role='menuitem']"))
            .find(el => (el as HTMLElement).innerText.toLowerCase().includes(modelKey)) || null;
        }
        if (!option) continue;

        const isRateLimited = (option as HTMLElement).innerText.toLowerCase().includes("limit") || option.getAttribute("aria-disabled") === "true";
        if (isRateLimited) {
          knownRateLimitedModels.add(modelKey);
          continue;
        }
        knownRateLimitedModels.delete(modelKey);

        setExtensionClick(800);
        setTimeout(() => {
          simulateOptionClick(option as HTMLElement);
          lastKnownModel = modelKey;
          extensionActionTimeout = setTimeout(() => {
            isExtensionClick = false;
            const newLabel = document.querySelector(TRIGGER_LABEL_SELECTOR);
            if (newLabel) lastKnownModel = getModelFromText((newLabel as HTMLElement).textContent || "");
          }, 800);
        }, 50);
        return;
      }
    }, 150);
    return;
  }

  if (lastKnownModel) {
    let bestIdx = 0;
    while (bestIdx < MODEL_HIERARCHY.length && knownRateLimitedModels.has(MODEL_HIERARCHY[bestIdx])) bestIdx++;
    if (MODEL_HIERARCHY.indexOf(lastKnownModel) === bestIdx) return;
  }

  const triggerBtn = document.querySelector(TRIGGER_SELECTOR);
  if (triggerBtn) {
    const now = Date.now();
    if (now - lastTriggerClickTime < 1000) return;

    setExtensionClick(1000);
    triggerBtn.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    (triggerBtn as HTMLElement).focus();
    triggerBtn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window, composed: true }));
    lastTriggerClickTime = now;
  }
}

let accumulatedChats = new Map<string, { title: string, url: string, isPinned: boolean, isGem?: boolean }>();
let lastChatsStr = '';
let isActiveTab = true;

const GEM_MAP_KEY = 'gemidesk_persisted_gem_map';

function getPersistedGemMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(GEM_MAP_KEY) || '{}');
  } catch (e) {
    return {};
  }
}

function saveGemId(chatId: string, gemId: string) {
  if (!chatId || !gemId) return;
  const map = getPersistedGemMap();
  if (map[chatId] !== gemId) {
    map[chatId] = gemId;
    localStorage.setItem(GEM_MAP_KEY, JSON.stringify(map));
  }
}

function getStoredGemId(chatId: string): string | null {
  if (!chatId) return null;
  const map = getPersistedGemMap();
  return map[chatId] || null;
}

ipcRenderer.on('set-active', (_event, active, currentHistory?: any[]) => {
  isActiveTab = active;
  if (active && currentHistory) {
    accumulatedChats.clear();
    currentHistory.forEach(chat => accumulatedChats.set(chat.url, chat));
    lastChatsStr = JSON.stringify(currentHistory);
  }
});

let isFixingGemError = false;

function detectAndFixGemError() {
  if (isFixingGemError) return;

  const bodyText = document.body.textContent || '';
  const isGemError = bodyText.includes('mit einem Gem erstellt, das gelöscht wurde') ||
    bodyText.includes('created with a Gem that was deleted') ||
    document.querySelector('.error-container')?.textContent?.includes('Gem');

  if (!isGemError) return;

  const chatIdMatch = location.href.match(/\/app\/([a-zA-Z0-9_-]+)/);
  if (!chatIdMatch) return;
  const chatId = chatIdMatch[1];

  isFixingGemError = true;

  const gemId = getStoredGemId(chatId) || getGemIdFromContext() || getGemIdFromChatIdRigorous(chatId);

  if (gemId) {
    saveGemId(chatId, gemId);
    location.replace(`https://gemini.google.com/gem/${gemId}/${chatId}?hl=de`);
    return;
  }

  setTimeout(() => { isFixingGemError = false; }, 3000);
}

function getGemIdFromContext(): string | null {
  try {
    let urlMatch = location.href.match(/\/gem\/([a-zA-Z0-9_-]+)/);
    if (urlMatch) return urlMatch[1];

    const logoutLink = document.querySelector('a[href*="Logout"]') as HTMLAnchorElement;
    if (logoutLink && logoutLink.href) {
      const urlParams = new URLSearchParams(new URL(logoutLink.href).search);
      const continueUrl = urlParams.get('continue');
      if (continueUrl) {
        const gemIdMatch = continueUrl.match(/\/gem\/([a-zA-Z0-9_-]+)/);
        if (gemIdMatch) return gemIdMatch[1];
      }
    }
  } catch (e) {
  }
  return null;
}

const extractChatId = (url: string) => {
  if (!url) return null;
  const match = url.match(/\/([a-zA-Z0-9_-]+)(?:\?.*)?$/);
  return match ? match[1] : null;
};

function getGemIdFromChatIdRigorous(chatId: string, preFetchedHtml?: string): string | null {
  if (!chatId) return null;
  const stored = getStoredGemId(chatId);
  if (stored) {
    if (stored === 'NONE') return null;
    return stored;
  }

  const links = Array.from(document.querySelectorAll(`a[href*="${chatId}"]`));
  for (const link of links) {
    const href = link.getAttribute('href') || '';
    let m = href.match(/\/gem\/([a-zA-Z0-9_]+)/);
    if (m) {
      saveGemId(chatId, m[1]);
      return m[1];
    }
  }

  const html = preFetchedHtml || document.documentElement.innerHTML;
  const idx = html.indexOf(`"${chatId}"`);
  if (idx !== -1) {
    const chunk = html.substring(Math.max(0, idx - 800), idx + 800);
    const gemMatches = chunk.match(/"([cgp]_[a-zA-Z0-9_]{10,}|[a-f0-9]{12,16})"/g) || [];
    for (const m of gemMatches) {
      const clean = m.replace(/"/g, '');
      if (clean !== chatId && clean.length >= 12) {
        saveGemId(chatId, clean);
        return clean;
      }
    }
    saveGemId(chatId, 'NONE');
  }
  return null;
}

function scrapeChatHistory(forceSend = false) {
  if (!isActiveTab && !forceSend) return;

  const currentGemId = getGemIdFromContext();
  const chatLinks = Array.from(document.querySelectorAll('a[href*="/app/"], a.conversation, a[href*="/gem/"]'));
  const scrapedByChatId = new Map<string, { title: string, url: string, isPinned: boolean, isGem?: boolean }>();
  let cachedHtml = '';

  chatLinks.forEach(link => {
    const ariaLabel = link.getAttribute('aria-label') || '';
    const textContent = link.textContent || '';

    const isPinned = !!link.closest('.pinned-conversation') ||
      !!link.closest('conversations-list[type="pinned"]') ||
      !!link.closest('.pinned-conversations') ||
      !!link.querySelector('mat-icon[svgicon*="pin"]') ||
      ariaLabel.toLowerCase().includes('angepinnter chat') ||
      ariaLabel.toLowerCase().includes('pinned chat') ||
      textContent.toLowerCase().includes('angepinnter chat');

    let title = (link.querySelector('.conversation-title, .text-content, span')?.textContent || textContent || '').trim();
    if (isPinned) {
      title = title.replace(/Angepinnter Chat:|Pinned chat:|Angepinnt:|Pinned:|Angepinnt|Pinned/ig, '').trim();
    }
    if (!title || title.length > 100) return;

    let url = link.getAttribute('href') || '';
    if (url.startsWith('https://gemini.google.com')) url = url.replace('https://gemini.google.com', '');

    const chatId = extractChatId(url);

    if (!chatId) return;

    let gemIdMatchArray = url.match(/\/gem\/([a-zA-Z0-9_-]+)/);
    let storedGemId = getStoredGemId(chatId);
    let gemId = gemIdMatchArray ? gemIdMatchArray[1] : (storedGemId === 'NONE' ? null : storedGemId);

    const hasGemIcon = !!link.querySelector('.bot-icon-spark, .gem-icon, img[src*="spark"]');
    const isUrlGem = url.includes('/gem/');

    if (!gemId && storedGemId !== 'NONE') {
      if (!cachedHtml) cachedHtml = document.documentElement.innerHTML;
      gemId = getGemIdFromChatIdRigorous(chatId, cachedHtml);
    }

    if (!gemId && location.pathname.includes(chatId) && currentGemId) {
      if (hasGemIcon || isUrlGem || location.pathname.includes('/gem/')) {
        gemId = currentGemId;
      }
    }

    if (gemId) {
      saveGemId(chatId, gemId);
    }

    const isGem = hasGemIcon || isUrlGem || !!gemId;
    let finalUrl = gemId ? `/gem/${gemId}/${chatId}` : url;

    const existing = scrapedByChatId.get(chatId);
    if (!existing || (!existing.isPinned && isPinned)) {
      scrapedByChatId.set(chatId, { title, url: finalUrl, isPinned, isGem });
    }
  });

  const finalScraped: any[] = [];
  const processedIds = new Set<string>();

  Array.from(scrapedByChatId.values()).forEach(chat => {
    if (chat.isPinned) {
      finalScraped.push(chat);
      const id = extractChatId(chat.url);
      if (id) processedIds.add(id);
    }
  });

  Array.from(scrapedByChatId.values()).forEach(chat => {
    const id = extractChatId(chat.url);
    if (!chat.isPinned && id && !processedIds.has(id)) {
      finalScraped.push(chat);
      processedIds.add(id);
    }
  });

  for (const [url, chat] of accumulatedChats.entries()) {
    const id = extractChatId(url);
    if (id && !processedIds.has(id)) {
      const knownGemId = getStoredGemId(id);
      if (knownGemId && knownGemId !== 'NONE' && !chat.url.includes('/gem/')) {
        chat.url = `/gem/${knownGemId}/${id}`;
        chat.isGem = true;
      }
      finalScraped.push(chat);
      processedIds.add(id);
    }
  }

  accumulatedChats.clear();
  finalScraped.forEach(chat => accumulatedChats.set(chat.url, chat));

  const bumpChatId = (window as any).bumpChatId || null;
  (window as any).bumpChatId = null;

  const chatsStr = JSON.stringify(finalScraped);
  if (chatsStr !== lastChatsStr || forceSend || bumpChatId) {
    lastChatsStr = chatsStr;
    const isGemSidebar = location.pathname.includes('/gem/') ||
      !!document.querySelector('header img[src*="googleusercontent"]:not([alt*="Account"]):not([alt*="Konto"])') ||
      !!currentGemId;
    const isGlobalSidebar = !isGemSidebar;

    ipcRenderer.send('chat-history', finalScraped, isGlobalSidebar, bumpChatId);
  }
}

let lastGemsStr = '';
function scrapeGems() {
  const isGemManager = location.href.includes('/gems/view');
  const elements: HTMLElement[] = [];

  if (isGemManager) {
    const myGemsHeader = Array.from(document.querySelectorAll('h1, h2, h3, .section-title, span, div')).find(el => {
      const txt = el.textContent?.trim();
      return txt === 'Meine Gems' || txt === 'My Gems' || txt === 'Your Gems';
    });

    if (myGemsHeader) {
      const section = myGemsHeader.closest('section, .section, div[role="list"]') ||
        myGemsHeader.parentElement?.nextElementSibling ||
        myGemsHeader.parentElement;
      if (section) {
        elements.push(...Array.from(section.querySelectorAll('a[href*="/gem/"]')) as HTMLElement[]);
      }
    }

    if (elements.length === 0) {
      const defaults = ['Storybook', 'Coding-Assistent', 'Coding Assistant', 'Kreativer Partner', 'Creative Partner', 'Karriereberater', 'Career advisor', 'Lernhilfe', 'Learning help', 'Productivity planner', 'Schreibassistent', 'Writing editor'];
      const allGemLinks = Array.from(document.querySelectorAll('a[href*="/gem/"]')) as HTMLElement[];
      const filtered = allGemLinks.filter(link => {
        const txt = link.textContent?.trim() || '';
        return !defaults.some(d => txt.includes(d));
      });
      elements.push(...filtered);
    }
  } else {
    elements.push(...Array.from(document.querySelectorAll('a[href*="/gem/"], button.bot-new-conversation-button, a[href*="/app/gem/"]')) as HTMLElement[]);
  }

  const gems = elements.map(el => {
    let url = el.getAttribute('href') || el.getAttribute('data-url') || '';
    const jslog = el.getAttribute('jslog') || '';

    if (!url || url === '#') {
      const idMatch = jslog.match(/\/gem\/([a-zA-Z0-9_]+)/) || jslog.match(/\["(?:c_)?([a-zA-Z0-9_]{10,})"\]/);
      if (idMatch) url = `/gem/${idMatch[1]}`;
    }

    if (url && (url.includes('/gem/') || url.includes('/app/gem/'))) {
      const titleEl = el.querySelector('.gem-name, .label, span, [class*="title"], .conversation-title, .text-content') || el;
      let title = titleEl.textContent?.trim() || el.getAttribute('aria-label') || '';

      if (['Nachricht senden', 'Send message', 'New chat', 'Neuer Chat', 'Gem erstellen'].includes(title)) return null;

      const iconImg = el.querySelector('img, .gem-icon img, svg, mat-icon') ||
        el.parentElement?.querySelector('img') ||
        el.closest('div[role="button"]')?.querySelector('img');
      let iconUrl = '';
      if (iconImg instanceof HTMLImageElement) {
        iconUrl = iconImg.src;
      } else if (iconImg && (iconImg.classList.contains('bot-icon-spark') || iconImg.textContent?.includes('spark'))) {
        iconUrl = '✨';
      }

      const cleanTitle = title.replace(/^Gem\s+/i, '').replace(/✨$/, '').trim();
      if (!cleanTitle || cleanTitle.length > 40) return null;

      return { title: cleanTitle, url, iconUrl };
    }
    return null;
  }).filter((g): g is { title: string, url: string, iconUrl: string } => g !== null && g.url !== '');

  const uniqueGems = Array.from(new Map(gems.map(g => [g.url, g])).values());

  if (!isGemManager) {
    return;
  }

  const gemsStr = JSON.stringify(uniqueGems);
  if (gemsStr !== lastGemsStr) {
    lastGemsStr = gemsStr;
    ipcRenderer.send('gem-history', uniqueGems);
  }
}

let lastGemIconUrl = '';
function detectActiveGemIcon() {
  const isGemPath = location.href.includes('/gem/') || location.href.includes('/app/gem/');

  if (!isGemPath) {
    if (lastGemIconUrl !== '') {
      lastGemIconUrl = '';
      ipcRenderer.send('active-gem-icon', null);
    }
    return;
  }

  const iconImg = document.querySelector([
    'header img[src*="googleusercontent"]:not([alt*="Account"]):not([alt*="Konto"])',
    '.gem-icon img',
    'img[src*="googleusercontent"][alt*="Gem"]'
  ].join(', '));

  let iconUrl = (iconImg as HTMLImageElement)?.src;

  if (!iconUrl) {
    const letterDiv = document.querySelector('header div[class*="avatar"], .gem-icon div, header span[class*="avatar"]');
    if (letterDiv && letterDiv.textContent?.trim().length === 1) {
      iconUrl = 'LETTER:' + letterDiv.textContent.trim().toUpperCase();
    }
  }

  if (!iconUrl) iconUrl = '✨';

  if (iconUrl !== lastGemIconUrl) {
    lastGemIconUrl = iconUrl;
    ipcRenderer.send('active-gem-icon', iconUrl);
  }
}

ipcRenderer.on('spa-navigate', async (_event, url) => {
  try {
    let targetUrl = url;
    const chatIdMatch = targetUrl.match(/\/app\/([a-zA-Z0-9_-]+)/) || targetUrl.match(/\/gem\/[^/]+\/([a-zA-Z0-9_-]+)/);
    const chatId = chatIdMatch ? chatIdMatch[1] : null;

    let gemId = targetUrl.match(/\/gem\/([a-zA-Z0-9_-]+)/)?.[1] || (chatId ? getStoredGemId(chatId) : null);

    if (chatId && gemId && !targetUrl.includes('/gem/')) {
      targetUrl = `https://gemini.google.com/gem/${gemId}/${chatId}?hl=de`;
    }

    const findAndClickLink = () => {
      let link = document.querySelector(`a[href*="${chatId}"]`) as HTMLAnchorElement;
      if (link) {
        link.click();
        return true;
      }
      return false;
    };

    if (findAndClickLink()) return;

    if (targetUrl !== location.href) {
      window.location.href = targetUrl;
    }

  } catch (e) {
    window.location.href = url;
  }
});

async function deleteChatByUrl(url: string) {
  let link = document.querySelector(`a[href="${url}"]`);

  if (!link) {
    const sidebar = document.querySelector('app-chat-history, .recent-chat-list, .mdc-drawer__content, mat-sidenav, .cdk-virtual-scroll-viewport');
    if (sidebar) {
      for (let i = 0; i < 15; i++) {
        sidebar.scrollTop += 800;
        await new Promise(r => setTimeout(r, 400));
        link = document.querySelector(`a[href="${url}"]`);
        if (link) break;
      }
    }
  }

  if (!link) return;

  const wrapper = link.closest('.recent-chat-item') || link.parentElement?.parentElement;
  if (!wrapper) return;

  const menuBtn = wrapper.querySelector('button[aria-haspopup="menu"], button');
  if (menuBtn) {
    (menuBtn as HTMLElement).click();
    await new Promise(r => setTimeout(r, 300));

    const items = Array.from(document.querySelectorAll('[role="menuitem"]'));
    const delItem = items.find(i => i.textContent?.toLowerCase().includes('delete') || i.textContent?.toLowerCase().includes('lösch'));

    if (delItem) {
      (delItem as HTMLElement).click();
      await new Promise(r => setTimeout(r, 500));

      const confirmBtns = Array.from(document.querySelectorAll('mat-dialog-container button, [role="dialog"] button'));
      const confirmBtn = confirmBtns.find(b => b.textContent?.toLowerCase().includes('delete') || b.textContent?.toLowerCase().includes('lösch'));
      if (confirmBtn) {
        (confirmBtn as HTMLElement).click();
        await new Promise(r => setTimeout(r, 500));
      }
    } else {
      document.body.click();
    }
  }
}

let isLazyLoading = false;

async function lazyLoadChats() {
  if (isLazyLoading) return;
  isLazyLoading = true;

  const sidenavContainer = document.querySelector('.sidenav-with-history-container, .my-stuff-side-nav, mat-drawer, mat-sidenav');
  const infiniteScroller = document.querySelector('infinite-scroller[scrollable="true"], infinite-scroller, .cdk-virtual-scroll-viewport, .overflow-container, mat-drawer-content, app-chat-history, .recent-chat-list');

  if (!infiniteScroller) {
    isLazyLoading = false;
    scrapeChatHistory(true);
    return;
  }

  if (sidenavContainer) {
    const isCollapsed = sidenavContainer.classList.contains('collapsed') ||
      sidenavContainer.getAttribute('opened') === 'false' ||
      getComputedStyle(sidenavContainer).visibility === 'hidden' ||
      sidenavContainer.clientWidth < 10;

    if (isCollapsed) {
      const menuBtn = document.querySelector('button[aria-label*="menü"], button[aria-label*="menu"], .hamburger-menu-button, [data-test-id="side-nav-toggle"]') as HTMLElement;
      if (menuBtn) {
        menuBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        menuBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        menuBtn.click();
        await new Promise(r => setTimeout(r, 600));
      }
    }

    sidenavContainer.classList.remove('collapsed');
    sidenavContainer.classList.add('expanded');
    (sidenavContainer as HTMLElement).style.display = 'flex';
  }

  const originalHeight = (infiniteScroller as HTMLElement).style.height;
  (infiniteScroller as HTMLElement).style.height = '2000px';

  setTimeout(() => {
    infiniteScroller.scrollTop = infiniteScroller.scrollHeight;
    infiniteScroller.dispatchEvent(new Event('scroll', { bubbles: true }));

    setTimeout(() => {
      infiniteScroller.scrollTop = infiniteScroller.scrollHeight;

      const chatLinks = document.querySelectorAll('a[href*="/app/"], a.conversation');
      if (chatLinks.length > 0) {
        const lastChat = chatLinks[chatLinks.length - 1];
        lastChat.scrollIntoView({ behavior: 'auto', block: 'end' });
      }

      setTimeout(() => {
        scrapeChatHistory(true);

        if (sidenavContainer) {
          sidenavContainer.classList.remove('expanded');
        }
        (infiniteScroller as HTMLElement).style.height = originalHeight;

        isLazyLoading = false;
      }, 1500);
    }, 500);
  }, 100);
}

async function preparePdfDownload() {
  const style = document.createElement('style');
  style.id = 'pdf-export-style';
  style.textContent = `
    .cdk-virtual-scroll-viewport, 
    app-chat-history, 
    .recent-chat-list, 
    .message-list, 
    .chat-history, 
    .scroll-container, 
    .infinite-scroll-component,
    .mat-drawer-content,
    .main-content,
    body,
    html {
      height: auto !important;
      max-height: none !important;
      overflow: visible !important;
      position: static !important;
      contain: none !important;
    }
  `;
  document.head.appendChild(style);

  window.scrollTo(0, 0);

  let scrolled = true;
  let attempts = 0;
  let currentScroll = 0;

  while (scrolled && attempts < 30) {
    const oldHeight = document.documentElement.scrollHeight;
    currentScroll += 2000;
    window.scrollTo(0, currentScroll);
    await new Promise(r => setTimeout(r, 800));

    if (window.scrollY + window.innerHeight >= oldHeight - 100) {
      scrolled = false;
    } else {
      attempts++;
    }
  }

  await new Promise(r => setTimeout(r, 1000));
}