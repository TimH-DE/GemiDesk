import { app, BrowserWindow, BrowserView, ipcMain, dialog, session } from 'electron';
import path from 'node:path';
import Store from 'electron-store';

const store = new Store();

const cleanupChatHistory = () => {
  const currentHistory = (store.get('chatHistory') || []) as any[];
  const folderMap = (store.get('folderMap') || {}) as Record<string, string>;
  const keptChats = currentHistory.filter(c => c.isPinned || folderMap[c.url]);
  store.set('chatHistory', keptChats);
};
cleanupChatHistory();

const userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const mobileUserAgent = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

app.commandLine.appendSwitch('user-agent', userAgent);
app.setName('GemiDesk');
app.userAgentFallback = userAgent;
app.commandLine.appendSwitch('disable-infobars');

process.env.DIST = path.join(__dirname, '../../dist');
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public');

let win: BrowserWindow | null;
const tabs = new Map<string, BrowserView>();
let activeTabId: string | null = null;
let currentSidebarWidth = 256;

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

const updateViewBounds = () => {
  if (!win || !activeTabId) return;
  const view = tabs.get(activeTabId);
  if (!view) return;
  
  const bounds = win.getContentBounds();
  view.setBounds({
    x: currentSidebarWidth,
    y: 48,
    width: bounds.width - currentSidebarWidth,
    height: bounds.height - 48
  });
};


ipcMain.handle('get-store', (_event, key: string) => {
  return store.get(key);
});

ipcMain.handle('set-store', (_event, key: string, value: any) => {
  store.set(key, value);
  return true;
});

ipcMain.handle('get-chat-history', () => {
  return store.get('chatHistory') || [];
});

ipcMain.handle('get-folders', () => {
  return store.get('folders') || [];
});

ipcMain.handle('get-folder-map', () => {
  return store.get('folderMap') || {};
});

ipcMain.handle('get-gems', () => {
  return store.get('gems') || [];
});


ipcMain.on('toggle-dev-mode', (_event, isEnabled) => {
  store.set('devMode', isEnabled);
  
  if (isEnabled) {
    if (win) win.webContents.openDevTools({ mode: 'detach' });
    if (activeTabId && tabs.has(activeTabId)) {
      tabs.get(activeTabId)!.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    if (win) win.webContents.closeDevTools();
    tabs.forEach(view => view.webContents.closeDevTools());
  }
});
ipcMain.on('toggle-sidebar', (_event, isOpen) => {
  if (!win) return;
  currentSidebarWidth = isOpen ? 256 : 0;
  updateViewBounds();
});

ipcMain.handle('new-tab', (_event, id: string, url: string = 'https://gemini.google.com/app') => {
  const view = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  view.webContents.on('did-navigate', (_event, url) => {
    if (win) {
      win.webContents.send('chat-url-changed', id, url);
    }
  });
  view.webContents.on('did-navigate-in-page', (_event, url) => {
    if (win) {
      win.webContents.send('chat-url-changed', id, url);
    }
  });
  
  view.setAutoResize({ width: true, height: true, horizontal: false, vertical: false });
  view.webContents.setUserAgent(userAgent);
  tabs.set(id, view);
  view.webContents.loadURL(url);
  
  view.webContents.on('did-finish-load', () => {
    view.webContents.send('main-process-message', (new Date).toLocaleString());
    view.webContents.send('set-active', activeTabId === id, store.get('chatHistory') || []);
  });
  
  setTimeout(() => {
    if (win && tabs.has(id)) {
      const view = tabs.get(id)!;
      const bounds = win.getContentBounds();
      view.setBounds({
        x: currentSidebarWidth,
        y: 48,
        width: bounds.width - currentSidebarWidth,
        height: bounds.height - 48
      });

      if (store.get('devMode')) {
        view.webContents.openDevTools({ mode: 'detach' });
      }
    }
  }, 50);

  return true;
});

ipcMain.handle('switch-tab', (_event, id: string) => {
  if (!win || !tabs.has(id)) return false;
  
  if (activeTabId && tabs.has(activeTabId)) {
    const oldView = tabs.get(activeTabId)!;
    win.removeBrowserView(oldView);
    oldView.webContents.send('set-active', false);
  }
  
  activeTabId = id;
  const view = tabs.get(id)!;
  win.addBrowserView(view);
  view.webContents.send('set-active', true, store.get('chatHistory') || []);
  
  if (store.get('devMode')) {
    view.webContents.openDevTools({ mode: 'detach' });
  }

  updateViewBounds();
  return true;
});

ipcMain.handle('close-tab', (_event, id: string) => {
  if (!win) return false;
  if (tabs.has(id)) {
    const view = tabs.get(id)!;
    if (activeTabId === id) {
      win.removeBrowserView(view);
      activeTabId = null;
    }
    // @ts-ignore
    view.webContents.destroy();
    tabs.delete(id);
  }
  return true;
});

ipcMain.handle('load-url', (_event, url: string) => {
  if (!activeTabId) return false;
  const view = tabs.get(activeTabId);
  if (view) {
    view.webContents.send('spa-navigate', url);
    return true;
  }
  return false;
});

ipcMain.handle('force-model', (_event, modelName: string) => {
  if (!activeTabId) return;
  const view = tabs.get(activeTabId);
  if (view) {
    view.webContents.send('set-model', modelName);
  }
});

ipcMain.handle('export-pdf', async () => {
  if (!activeTabId || !tabs.has(activeTabId)) return false;
  const view = tabs.get(activeTabId)!;
  
  view.webContents.send('prepare-pdf-download');
  
  return new Promise((resolve) => {
    const listener = async () => {
      try {
        const pdf = await view.webContents.printToPDF({
          printBackground: true,
          pageSize: 'A4'
        });
        const { canceled, filePath } = await dialog.showSaveDialog({
          title: 'Export Chat as PDF',
          defaultPath: 'gemidesk-chat.pdf',
          filters: [{ name: 'PDF', extensions: ['pdf'] }]
        });
        if (!canceled && filePath) {
          require('node:fs').writeFileSync(filePath, pdf);
          resolve(true);
        } else {
          resolve(false);
        }
      } catch (e) {
        console.error('PDF export failed', e);
        resolve(false);
      } finally {
        ipcMain.removeListener('pdf-ready', listener);
        view.webContents.send('cleanup-pdf');
      }
    };
    
    ipcMain.on('pdf-ready', listener);
    setTimeout(() => {
      ipcMain.removeListener('pdf-ready', listener);
      resolve(false);
    }, 30000);
  });
});

const getChatId = (url: string) => {
  const match = url.match(/\/([a-zA-Z0-9_-]+)(?:\?.*)?$/);
  return match ? match[1] : url;
};

const updateChatTitle = (url: string, title: string) => {
  const chatId = getChatId(url);
  if (!chatId || chatId === 'app' || chatId.includes('gemini.google.com')) return;

  const history = (store.get('chatHistory') || []) as any[];
  const idx = history.findIndex(c => getChatId(c.url) === chatId);
  
  if (idx !== -1) {
    const cleanTitle = title.replace(' - Gemini', '').trim();
    if (history[idx].title !== cleanTitle) {
      history[idx].title = cleanTitle;
      store.set('chatHistory', history);
      if (win) win.webContents.send('chat-history', history);
    }
  }
};

ipcMain.on('chat-title-changed', (event, title) => {
  const viewEntry = Array.from(tabs.entries()).find(([, v]) => v.webContents === event.sender);
  if (viewEntry) {
    const [tabId, view] = viewEntry;
    const url = view.webContents.getURL();
    updateChatTitle(url, title);
    if (win) win.webContents.send('chat-title-changed', tabId, title);
  }
});

ipcMain.on('chat-history', (_event, newChats, isGlobalSidebar = true, bumpActiveChatId = null) => {
  if (win) {
    const storedChats = (store.get('chatHistory') || []) as any[];
    let merged: any[] = [];
    
    if (isGlobalSidebar) {
      const chatMap = new Map<string, any>();
      
      newChats.forEach((chat: any) => {
        chatMap.set(getChatId(chat.url), chat);
      });
      
      storedChats.forEach((chat: any) => {
        const id = getChatId(chat.url);
        if (!chatMap.has(id)) {
          chatMap.set(id, chat);
        }
      });
      
      merged = Array.from(chatMap.values());
    } else {
      const storedIds = new Set(storedChats.map(c => getChatId(c.url)));
      const trulyNewChats = newChats.filter((c: any) => !storedIds.has(getChatId(c.url)));
      
      const newChatMap = new Map<string, any>();
      newChats.forEach((c: any) => newChatMap.set(getChatId(c.url), c));
      
      const updatedStoredChats = storedChats.map(c => {
        const id = getChatId(c.url);
        if (newChatMap.has(id)) {
          return { ...c, ...newChatMap.get(id) };
        }
        return c;
      });
      
      merged = [...trulyNewChats, ...updatedStoredChats];
    }

    if (bumpActiveChatId) {
      const activeIdx = merged.findIndex(c => getChatId(c.url) === bumpActiveChatId);
      if (activeIdx > 0) {
        const [activeChat] = merged.splice(activeIdx, 1);
        
        const folderMap = (store.get('folderMap') || {}) as Record<string, string>;
        let insertIdx = 0;
        for (let i = merged.length - 1; i >= 0; i--) {
          if (merged[i].isPinned && !folderMap[merged[i].url]) {
            insertIdx = i + 1;
            break;
          }
        }
        
        merged.splice(insertIdx, 0, activeChat);
      }
    }

    store.set('chatHistory', merged);
    win.webContents.send('chat-history', merged);
  }
});

ipcMain.handle('clear-app-data', async () => {
  store.clear();
  app.relaunch();
  app.exit();
});

ipcMain.handle('logout', async () => {
  store.clear();
  await session.defaultSession.clearStorageData();
  app.relaunch();
  app.exit();
});

ipcMain.on('toggle-pin-chat', (_event, url) => {
  if (activeTabId && tabs.has(activeTabId)) {
    const view = tabs.get(activeTabId);
    if (view) {
      view.webContents.send('toggle-pin-chat', url);
    }
  }
});

ipcMain.on('gem-history', (_event, gems) => {
  if (win) {
    store.set('gems', gems);
    win.webContents.send('gem-history', gems);
  }
});

ipcMain.on('sidebar-width-changed', (_event, width) => {
  currentSidebarWidth = width;
  updateViewBounds();
});

ipcMain.on('set-view-visibility', (_event, isVisible) => {
  if (!win || !activeTabId) return;
  const view = tabs.get(activeTabId);
  if (!view) return;
  
  if (isVisible) {
    win.addBrowserView(view);
  } else {
    win.removeBrowserView(view);
  }
});


function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC || '', 'icon.png'),
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'GemiDesk',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.webContents.setUserAgent(userAgent);

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(process.env.DIST || '', 'index.html'));
  }

  if (store.get('devMode')) {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  const scraperView = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: true,
    }
  });
  scraperView.webContents.setUserAgent(userAgent);
  scraperView.webContents.setAudioMuted(true);
  scraperView.webContents.loadURL('https://gemini.google.com/gems/view');
  
  setInterval(() => {
    scraperView.webContents.loadURL('https://gemini.google.com/gems/view');
  }, 1000 * 60 * 30);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    win = null;
    tabs.clear();
    activeTabId = null;
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(() => {
  session.defaultSession.webRequest.onBeforeSendHeaders((details: any, callback: any) => {
    if (details.url.includes('accounts.google.com')) {
      details.requestHeaders['User-Agent'] = mobileUserAgent;
    } else {
      details.requestHeaders['User-Agent'] = userAgent;
    }
    delete details.requestHeaders['X-Requested-With'];
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });

  createWindow();
});
