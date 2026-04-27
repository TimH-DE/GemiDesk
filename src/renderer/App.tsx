import { useState, useEffect, MouseEvent, ChangeEvent } from 'react';
import {
  Folder, Plus, Settings, MessageSquare, Menu, Download,
  Image as ImageIcon, Sparkles, Trash2, MoreVertical,
  CheckSquare, FolderMinus, Pin, PinOff,
  Pencil, Check, X, ExternalLink, ChevronRight,
  ArrowUp, ArrowDown, FolderPlus, Move
} from 'lucide-react';

const getChatId = (url: string) => {
  if (!url) return null;
  const match = url.match(/\/([a-zA-Z0-9_-]+)(?:\?.*)?$/);
  return match ? match[1] : url;
};

export default function App() {
  const [tabs, setTabs] = useState<{ id: string, title: string, active: boolean, icon?: string | null, url?: string }[]>([{ id: 'tab-1', title: 'Neuer Chat', active: true }]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedModel, setSelectedModel] = useState('Pro');
  const [chats, setChats] = useState<{ title: string, url: string, isPinned?: boolean, isGem?: boolean }[]>([]);
  const [gems, setGems] = useState<{ title: string, url: string, iconUrl: string }[]>([]);
  const [selectedChats, setSelectedChats] = useState<Set<string>>(new Set());
  const [folderMap, setFolderMap] = useState<Record<string, string>>({});
  const [folders, setFolders] = useState<{ id: string, name: string, parentId?: string }[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState('general');
  const [enhancerApiKey, setEnhancerApiKey] = useState('');
  const [appTheme, setAppTheme] = useState<'dark' | 'light'>('dark');
  const [exportFormat, setExportFormat] = useState<'pdf' | 'text' | 'markdown'>('pdf');
  const [tabBehavior, setTabBehavior] = useState<'new' | 'replace'>('replace');
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [hoveredChat, setHoveredChat] = useState<string | null>(null);
  const [isFolderPopupOpen, setIsFolderPopupOpen] = useState<string | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number, y: number, url: string } | null>(null);
  const [isHoveringMenu, setIsHoveringMenu] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isDevMode, setIsDevMode] = useState(false);
  const [movingFolderId, setMovingFolderId] = useState<string | null>(null);

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [chatsPerFolderLimit, setChatsPerFolderLimit] = useState(10);
  const [folderPageLimits, setFolderPageLimits] = useState<Record<string, number>>({});

  const activeTab = tabs.find(t => t.active);
  const activeTabId = activeTab?.id;
  const tabUrls: Record<string, string> = tabs.reduce((acc, t) => ({ ...acc, [t.id]: t.url || '' }), {});

  useEffect(() => {
    const ipc = (window as any).ipcRenderer;
    ipc.invoke('new-tab', 'tab-1').then(() => {
      ipc.invoke('switch-tab', 'tab-1');
    });

    ipc.invoke('get-store', 'folderMap').then((res: any) => res && setFolderMap(res));
    ipc.invoke('get-store', 'folders').then((res: any) => res && setFolders(res));
    ipc.invoke('get-store', 'enhancerApiKey').then((res: any) => res && setEnhancerApiKey(res));
    ipc.invoke('get-store', 'appTheme').then((res: any) => {
      if (res) {
        setAppTheme(res);
        document.documentElement.className = res;
      }
    });
    ipc.invoke('get-store', 'exportFormat').then((res: any) => res && setExportFormat(res));
    ipc.invoke('get-store', 'tabBehavior').then((res: any) => res && setTabBehavior(res));
    ipc.invoke('get-chat-history').then((res: any) => res && setChats(res));
    ipc.invoke('get-folders').then(setFolders);
    ipc.invoke('get-folder-map').then(setFolderMap);
    ipc.invoke('get-gems').then((res: any) => res && setGems(res));
    ipc.invoke('get-store', 'chatsPerFolderLimit').then((res: any) => res && setChatsPerFolderLimit(res));
    ipc.invoke('get-store', 'expandedFolders').then((res: any) => res && setExpandedFolders(new Set(res)));
    ipc.invoke('get-store', 'selectedModel').then((res: any) => {
      if (res) {
        setSelectedModel(res);
        ipc.invoke('force-model', res);
      }
    });

    const handleChatHistory = (_event: any, newChats: any[]) => {
      setChats(newChats);
      setIsLoadingMore(false);
    };
    ipc.on('chat-history', handleChatHistory);

    const handleChatTitleChanged = (_event: any, tabId: string, title: string) => {
      setTabs(prev => prev.map(t => {
        if (t.id === tabId) {
          const cleanTitle = title.replace(' - Gemini', '').trim();
          return { ...t, title: cleanTitle };
        }
        return t;
      }));
    };
    ipc.on('chat-title-changed', handleChatTitleChanged);

    const handleGemHistory = (_event: any, gems: { title: string, url: string, iconUrl: string }[]) => {
      console.log('GemiDesk: Received gem-history:', gems);
      setGems(gems);
    };
    ipc.on('gem-history', handleGemHistory);

    const handleActiveGemIcon = (_event: any, tabId: string, iconUrl: string | null) => {
      setTabs(prev => prev.map(t => t.id === tabId ? { ...t, icon: iconUrl } : t));
    };
    ipc.on('active-gem-icon', handleActiveGemIcon);

    const handleChatUrlChanged = (_event: any, tabId: string, url: string) => {
      console.log('GemiDesk: chat-url-changed:', tabId, url);
      setTabs(prev => prev.map(t => t.id === tabId ? { ...t, url } : t));
    };
    ipc.on('chat-url-changed', handleChatUrlChanged);

    return () => {
      ipc.off('chat-history', handleChatHistory);
      ipc.off('chat-title-changed', handleChatTitleChanged);
      ipc.off('gem-history', handleGemHistory);
      ipc.off('active-gem-icon', handleActiveGemIcon);
      ipc.off('chat-url-changed', handleChatUrlChanged);
    };
  }, []);

  const handleAddFolder = async (name?: string, parentId?: string) => {
    const folderName = name || newFolderName.trim();
    if (!folderName) return;
    const newFolder: { id: string, name: string, parentId?: string } = { id: `f-${Date.now()}`, name: folderName, parentId };
    const updatedFolders = [...folders, newFolder];
    setFolders(updatedFolders);
    setNewFolderName('');
    await (window as any).ipcRenderer.invoke('set-store', 'folders', updatedFolders);
  };

  const moveFolder = async (id: string, direction: 'up' | 'down') => {
    const folder = folders.find(f => f.id === id);
    if (!folder) return;

    const parentId = folder.parentId;
    const siblings = folders.filter(f => f.parentId === parentId);
    const idx = siblings.findIndex(f => f.id === id);

    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === siblings.length - 1) return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const targetFolder = siblings[targetIdx];

    const folderIdx = folders.findIndex(f => f.id === id);
    const targetFolderIdx = folders.findIndex(f => f.id === targetFolder.id);

    const newFolders = [...folders];
    [newFolders[folderIdx], newFolders[targetFolderIdx]] = [newFolders[targetFolderIdx], newFolders[folderIdx]];

    setFolders(newFolders);
    await (window as any).ipcRenderer.invoke('set-store', 'folders', newFolders);
  };

  const handleDeleteFolder = async (id: string) => {
    const getDescendantIds = (folderId: string): string[] => {
      const children = folders.filter(f => f.parentId === folderId);
      let ids = children.map(c => c.id);
      children.forEach(c => {
        ids = [...ids, ...getDescendantIds(c.id)];
      });
      return ids;
    };

    const idsToDelete = [id, ...getDescendantIds(id)];
    const updatedFolders = folders.filter(f => !idsToDelete.includes(f.id));
    setFolders(updatedFolders);

    const newMap = { ...folderMap };
    Object.keys(newMap).forEach(url => {
      if (idsToDelete.includes(newMap[url])) delete newMap[url];
    });
    setFolderMap(newMap);

    await (window as any).ipcRenderer.invoke('set-store', 'folders', updatedFolders);
    await (window as any).ipcRenderer.invoke('set-store', 'folderMap', newMap);
  };

  const handleMoveFolderToParent = async (folderId: string, newParentId?: string) => {
    const getDescendantIds = (fid: string): string[] => {
      const children = folders.filter(f => f.parentId === fid);
      let ids = children.map(c => c.id);
      children.forEach(c => {
        ids = [...ids, ...getDescendantIds(c.id)];
      });
      return ids;
    };

    if (newParentId === folderId || (newParentId && getDescendantIds(folderId).includes(newParentId))) {
      alert("Ein Ordner kann nicht in sich selbst oder seine Unterordner verschoben werden.");
      return;
    }

    const updatedFolders = folders.map(f => f.id === folderId ? { ...f, parentId: newParentId } : f);
    setFolders(updatedFolders);
    setMovingFolderId(null);
    await (window as any).ipcRenderer.invoke('set-store', 'folders', updatedFolders);
  };

  const handleRenameFolder = async () => {
    if (!editingFolderId || !editingFolderName.trim()) return;
    const updatedFolders = folders.map(f => f.id === editingFolderId ? { ...f, name: editingFolderName.trim() } : f);
    setFolders(updatedFolders);
    setEditingFolderId(null);
    setEditingFolderName('');
    await (window as any).ipcRenderer.invoke('set-store', 'folders', updatedFolders);
  };

  const toggleFolder = async (id: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedFolders(newExpanded);
    await (window as any).ipcRenderer.invoke('set-store', 'expandedFolders', Array.from(newExpanded));
  };

  const loadMoreInFolder = (id: string) => {
    setFolderPageLimits(prev => ({
      ...prev,
      [id]: (prev[id] || chatsPerFolderLimit) + chatsPerFolderLimit
    }));
  };

  const toggleTheme = async () => {
    const newTheme = appTheme === 'dark' ? 'light' : 'dark';
    setAppTheme(newTheme);
    document.documentElement.className = newTheme;
    await (window as any).ipcRenderer.invoke('set-store', 'appTheme', newTheme);
    await (window as any).ipcRenderer.invoke('set-theme', newTheme);
  };

  const handleNewTab = async () => {
    const newId = `tab-${Date.now()}`;
    const newTabs = tabs.map(t => ({ ...t, active: false }));
    newTabs.push({ id: newId, title: 'Neuer Chat', active: true });
    setTabs(newTabs);
    const ipc = (window as any).ipcRenderer;
    await ipc.invoke('new-tab', newId);
    await ipc.invoke('switch-tab', newId);
  };

  const handleSwitchTab = async (id: string) => {
    setTabs(tabs.map(t => ({ ...t, active: t.id === id })));
    await (window as any).ipcRenderer.invoke('switch-tab', id);
  };

  const handleModelChange = async (e: ChangeEvent<HTMLSelectElement>) => {
    const model = e.target.value;
    setSelectedModel(model);
    const ipc = (window as any).ipcRenderer;
    await ipc.invoke('force-model', model);
    await ipc.invoke('set-store', 'selectedModel', model);
  };

  const handleCloseTab = async (e: MouseEvent, id: string) => {
    e.stopPropagation();
    const newTabs = tabs.filter(t => t.id !== id);
    if (newTabs.length === 0) {
      newTabs.push({ id: `tab-${Date.now()}`, title: 'Neuer Chat', active: true });
      const ipc = (window as any).ipcRenderer;
      await ipc.invoke('new-tab', newTabs[0].id);
      await ipc.invoke('switch-tab', newTabs[0].id);
    } else if (tabs.find(t => t.id === id)?.active) {
      const activeIdx = tabs.findIndex(t => t.id === id);
      const nextIdx = activeIdx > 0 ? activeIdx - 1 : 0;
      newTabs[nextIdx].active = true;
      await (window as any).ipcRenderer.invoke('switch-tab', newTabs[nextIdx].id);
    }
    setTabs(newTabs);
    await (window as any).ipcRenderer.invoke('close-tab', id);
  };

  const handleMoveToFolder = async (folderId: string) => {
    const urlsToMove = selectedChats.size > 0 ? Array.from(selectedChats) : isFolderPopupOpen && isFolderPopupOpen !== 'bulk' ? [isFolderPopupOpen] : [];
    if (urlsToMove.length === 0) return;

    const newMap = { ...folderMap };
    for (const url of urlsToMove) {
      newMap[url] = folderId;
    }
    setFolderMap(newMap);
    setSelectedChats(new Set());
    setIsFolderPopupOpen(null);
    (window as any).ipcRenderer.send('set-view-visibility', true);
    await (window as any).ipcRenderer.invoke('set-store', 'folderMap', newMap);
  };

  const handleRemoveFromFolder = async (urls: string[]) => {
    if (urls.length === 0) return;
    const newMap = { ...folderMap };
    for (const url of urls) {
      delete newMap[url];
    }
    setFolderMap(newMap);
    setSelectedChats(new Set());
    await (window as any).ipcRenderer.invoke('set-store', 'folderMap', newMap);
  };

  useEffect(() => {
    let menuTimer: NodeJS.Timeout;
    if (contextMenuPos && !isHoveringMenu && hoveredChat !== contextMenuPos.url) {
      menuTimer = setTimeout(() => {
        setContextMenuPos(null);
      }, 300);
    }
    return () => clearTimeout(menuTimer);
  }, [contextMenuPos, isHoveringMenu, hoveredChat]);

  const prepareGemUrl = (url: string): string => {
    let finalUrl = url;
    if (url.includes('/app/gem/')) {
      finalUrl = url.replace('/app/gem/', '/gem/');
    }

    if (finalUrl.includes('/gem/')) {
      if (!finalUrl.startsWith('http')) {
        finalUrl = `https://gemini.google.com${finalUrl.startsWith('/') ? '' : '/'}${finalUrl}`;
      }
      if (!finalUrl.includes('hl=')) {
        finalUrl = finalUrl.includes('?') ? `${finalUrl}&hl=de` : `${finalUrl}?hl=de`;
      }
    }
    return finalUrl;
  };

  const handleChatClick = async (url: string) => {
    const behavior = tabBehavior;
    const finalUrl = prepareGemUrl(url);

    if (behavior === 'new') {
      handleOpenInNewTab(finalUrl);
    } else {
      await (window as any).ipcRenderer.invoke('load-url', finalUrl);
    }
  };

  const handleOpenInNewTab = async (url: string) => {
    const finalUrl = prepareGemUrl(url);
    const newId = `tab-${Date.now()}`;
    const newTabs = tabs.map(t => ({ ...t, active: false }));
    newTabs.push({ id: newId, title: 'Chat', active: true });
    setTabs(newTabs);
    const ipc = (window as any).ipcRenderer;
    await ipc.invoke('new-tab', newId, finalUrl.startsWith('/') ? 'https://gemini.google.com' + finalUrl : finalUrl);
    await ipc.invoke('switch-tab', newId);
  };

  const toggleSidebar = () => {
    const newState = !isSidebarOpen;
    setIsSidebarOpen(newState);
    (window as any).ipcRenderer.send('toggle-sidebar', newState);
  };

  const handleBulkDelete = async () => {
    if (selectedChats.size === 0) return;
    const urlsToDelete = Array.from(selectedChats);
    await (window as any).ipcRenderer.invoke('bulk-delete', urlsToDelete);
    setSelectedChats(new Set());
  };

  const handleGeminiLink = async (item: string) => {
    const links: Record<string, string> = {
      'Anweisungen für Gemini': 'https://gemini.google.com/saved-info',
      'Verbundene Apps': 'https://gemini.google.com/extensions',
      'Geplante Aktionen': 'https://gemini.google.com/scheduled',
      'Meine öffentlichen Links': 'https://gemini.google.com/sharing',
      'Abo verwalten': 'https://one.google.com/settings',
      'NotebookLM': 'https://notebooklm.google.com/',
      'Gems verwalten': 'https://gemini.google.com/gems/view',
      'Hilfe': 'https://support.google.com/gemini'
    };

    const url = links[item];
    if (url) {
      const behavior = tabBehavior;
      if (behavior === 'new') {
        handleOpenInNewTab(url);
      } else {
        await (window as any).ipcRenderer.invoke('load-url', url);
      }
    }
  };

  const renderFolder = (f: any, level = 0) => {
    const folderChats = chats.filter(c => folderMap[c.url] === f.id);
    const subfolders = folders.filter(sf => sf.parentId === f.id);
    const isExpanded = expandedFolders.has(f.id);
    const limit = folderPageLimits[f.id] || chatsPerFolderLimit;
    const displayedChats = folderChats.slice(0, limit);
    const hasMore = folderChats.length > limit;
    const activeChatId = activeTabId && tabUrls[activeTabId] ? getChatId(tabUrls[activeTabId]) : null;

    return (
      <div key={f.id} className={`${level > 0 ? 'mt-0.5' : 'mb-1'}`}>
        <div
          onClick={() => toggleFolder(f.id)}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors group"
        >
          <ChevronRight size={14} className={`folder-chevron text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] ${isExpanded ? 'expanded' : ''}`} />
          <Folder size={16} className="text-[var(--accent)]" />
          <span className="font-medium truncate flex-1">{f.name}</span>
          {(folderChats.length > 0 || subfolders.length > 0) && (
            <span className="text-[10px] text-[var(--text-secondary)] opacity-50 px-1.5 py-0.5 bg-[var(--bg-main)] rounded-full border border-[var(--border-color)]">
              {folderChats.length + subfolders.length}
            </span>
          )}
        </div>

        <div className={`folder-content-wrapper ${isExpanded ? 'expanded' : ''}`}>
          <div className="folder-content">
            <div className={`ml-4 space-y-0.5 border-l border-[var(--border-color)] pl-2 mt-1 mb-2`}>
              {/* Subfolders */}
              {subfolders.map(sf => renderFolder(sf, level + 1))}

              {/* Chats */}
              {displayedChats.map(chat => {
                const isActive = activeChatId && getChatId(chat.url) === activeChatId;
                return (
                  <div key={chat.url}
                    onMouseEnter={() => setHoveredChat(chat.url)}
                    onMouseLeave={() => setHoveredChat(null)}
                    onClick={() => isSelectionMode ? undefined : handleChatClick(chat.url)}
                    className={`relative flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-sm group cursor-pointer 
                      ${isActive ? 'bg-[var(--bg-hover)] text-[var(--accent)]' : 'hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
                    {isSelectionMode ? (
                      <input type="checkbox" checked={selectedChats.has(chat.url)} onChange={(e) => {
                        const newSet = new Set(selectedChats);
                        if (e.target.checked) newSet.add(chat.url); else newSet.delete(chat.url);
                        setSelectedChats(newSet);
                      }} className="cursor-pointer" />
                    ) : (
                      <div className="shrink-0 flex items-center justify-center w-4 h-4">
                        {(chat.isGem || chat.url.includes('/gem/')) ? (
                          <Sparkles size={14} className={isActive ? 'text-[var(--accent)]' : 'text-[var(--accent)] opacity-60'} />
                        ) : (
                          <MessageSquare size={14} className={isActive ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'} />
                        )}
                      </div>
                    )}
                    <span className="truncate flex-1">{chat.title}</span>
                  </div>
                );
              })}
              {hasMore && (
                <button
                  onClick={(e) => { e.stopPropagation(); loadMoreInFolder(f.id); }}
                  className="w-full text-left px-2 py-1.5 text-[10px] text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors font-medium flex items-center gap-1"
                >
                  <Plus size={10} />
                  Mehr laden... ({folderChats.length - limit} weitere)
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSettingsFolder = (f: any, level = 0) => {
    return (
      <div key={f.id} className="space-y-1">
        <div className={`settings-item group ${level > 0 ? 'ml-8' : ''}`}>
          {editingFolderId === f.id ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                type="text"
                autoFocus
                value={editingFolderName}
                onChange={(e) => setEditingFolderName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' ? handleRenameFolder() : e.key === 'Escape' && setEditingFolderId(null)}
                className="input-field flex-1 py-1"
              />
              <button onClick={handleRenameFolder} className="text-[var(--accent)] hover:text-[var(--text-primary)]"><Check size={18} /></button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <Folder size={18} className="text-[var(--accent)]" />
                <span className="text-sm font-medium">{f.name}</span>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => moveFolder(f.id, 'up')}
                  className="p-1.5 rounded-lg hover:bg-[var(--bg-main)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  title="Nach oben verschieben"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  onClick={() => moveFolder(f.id, 'down')}
                  className="p-1.5 rounded-lg hover:bg-[var(--bg-main)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  title="Nach unten verschieben"
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  onClick={() => {
                    const subName = window.prompt('Name des Unterordners:');
                    if (subName) handleAddFolder(subName, f.id);
                  }}
                  className="p-1.5 rounded-lg hover:bg-[var(--bg-main)] text-[var(--text-secondary)] hover:text-[var(--accent)]"
                  title="Unterordner hinzufügen"
                >
                  <FolderPlus size={14} />
                </button>
                <button
                  onClick={() => setMovingFolderId(f.id)}
                  className="p-1.5 rounded-lg hover:bg-[var(--bg-main)] text-[var(--text-secondary)] hover:text-[var(--accent)]"
                  title="In anderen Ordner verschieben"
                >
                  <Move size={14} />
                </button>
                <button
                  onClick={() => { setEditingFolderId(f.id); setEditingFolderName(f.name); }}
                  className="p-1.5 rounded-lg hover:bg-[var(--bg-main)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  title="Umbenennen"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDeleteFolder(f.id)}
                  className="p-1.5 rounded-lg hover:bg-red-500/20 text-[var(--text-secondary)] hover:text-red-400"
                  title="Löschen"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </>
          )}
        </div>
        {/* Render Children */}
        <div className="space-y-1">
          {folders.filter(sf => sf.parentId === f.id).map(sf => renderSettingsFolder(sf, level + 1))}
        </div>
      </div>
    );
  };

  return (
    <div className={`flex h-screen w-screen overflow-hidden bg-[var(--bg-main)] text-[var(--text-primary)] font-sans ${appTheme}`}>
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 ease-in-out flex flex-col bg-[var(--bg-sidebar)] border-r border-[var(--border-color)]`}>
        <div className="h-14 flex items-center justify-between px-4 border-b border-[var(--border-color)]">
          <h1 className="text-sm font-semibold tracking-wide text-[var(--text-secondary)]">GemiDesk</h1>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <div className="shrink-0 p-3 space-y-2">
            <button
              onClick={handleNewTab}
              className="w-full flex items-center justify-start gap-3 px-3 py-2 bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-lg transition-colors font-medium border border-[var(--border-color)]"
            >
              <Plus size={16} className="text-[var(--text-secondary)]" />
              <span>Neuer Chat</span>
            </button>
          </div>

          <div
            className="flex-1 overflow-y-auto hide-scrollbar px-3 space-y-6 pb-6"
            onScroll={(e) => {
              const target = e.currentTarget;
              if (target.scrollTop + target.clientHeight >= target.scrollHeight - 20) {
                if (!isLoadingMore) {
                  setIsLoadingMore(true);
                  (window as any).ipcRenderer.send('load-more-chats');
                  setTimeout(() => setIsLoadingMore(false), 5000);
                }
              }
            }}
          >
            {/* Ordner Sektion */}
            <div>
              <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 ml-1">Ordner</h2>
              {folders.length === 0 && (
                <p className="text-[10px] text-[var(--text-secondary)] ml-1 italic opacity-50">Keine Ordner erstellt</p>
              )}
              {folders.filter(f => !f.parentId).map(f => renderFolder(f))}
            </div>

            {/* Gems Sektion */}
            <div className="border-b border-[var(--border-color)] pb-4">
              <div
                className="flex items-center justify-between group cursor-pointer mb-2 ml-1"
                onClick={() => { setActiveSettingsTab('gems'); setIsSettingsOpen(true); (window as any).ipcRenderer.send('set-view-visibility', false); }}
              >
                <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Gems</h2>
                <ChevronRight size={14} className="text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition-colors opacity-50 group-hover:opacity-100" />
              </div>

              <div className="space-y-1">
                {gems.length === 0 && (
                  <p className="text-[10px] text-[var(--text-secondary)] ml-1 italic opacity-50">Keine Gems gefunden</p>
                )}
                {gems.map(gem => {
                  const isActive = activeTabId && tabUrls[activeTabId] && getChatId(tabUrls[activeTabId]) === getChatId(gem.url);
                  return (
                    <div key={gem.url}
                      onClick={() => handleChatClick(gem.url)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm group cursor-pointer 
                        ${isActive ? 'bg-[var(--bg-hover)] text-[var(--accent)]' : 'hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
                      <div className="shrink-0 flex items-center justify-center w-5 h-5 overflow-hidden rounded-full">
                        {gem.iconUrl && gem.iconUrl !== '✨' ? (
                          <img src={gem.iconUrl} className="w-full h-full object-cover" />
                        ) : (
                          <Sparkles size={16} className="text-[var(--accent)]" />
                        )}
                      </div>
                      <span className="truncate flex-1 font-medium">{gem.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Angepinnt Sektion */}
            {chats.some(c => c.isPinned && !folderMap[c.url]) && (
              <div className="border-b border-[var(--border-color)] pb-4 mb-4">
                <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2 ml-1">Angepinnt</h2>
                <div className="space-y-1">
                  {chats.filter(c => c.isPinned && !folderMap[c.url]).map((chat) => {
                    const activeChatId = activeTabId && tabUrls[activeTabId] ? getChatId(tabUrls[activeTabId]) : null;
                    const isActive = activeChatId && getChatId(chat.url) === activeChatId;
                    return (
                      <div key={chat.url}
                        onMouseEnter={() => setHoveredChat(chat.url)}
                        onMouseLeave={() => setHoveredChat(null)}
                        onClick={() => isSelectionMode ? undefined : handleChatClick(chat.url)}
                        className={`relative flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm group cursor-pointer 
                          ${isActive ? 'bg-[var(--bg-hover)] text-[var(--accent)]' : 'hover:bg-[var(--bg-hover)] text-[var(--text-primary)]'}`}>
                        <div className="relative shrink-0 flex items-center justify-center w-5 h-5">
                          {(chat.isGem || chat.url.includes('/gem/')) ? (
                            <Sparkles size={16} className="text-[var(--accent)]" />
                          ) : (
                            <MessageSquare size={16} className={isActive ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'} />
                          )}
                          <div className="absolute top-0 right-0 bg-[var(--bg-sidebar)] rounded-full p-0.5 z-10 shadow-sm border border-[var(--border-color)]">
                            <Pin size={10} className="text-[var(--accent)]" fill="currentColor" />
                          </div>
                        </div>
                        <span className={`truncate flex-1 transition-all ${(hoveredChat === chat.url || contextMenuPos?.url === chat.url) && !isSelectionMode ? 'pr-7' : ''}`}>{chat.title}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            setContextMenuPos(contextMenuPos?.url === chat.url ? null : { x: rect.right, y: rect.bottom, url: chat.url });
                          }}
                          className={`absolute right-2 p-1 hover:bg-[var(--bg-main)] rounded text-[var(--text-primary)] transition-opacity ${(hoveredChat === chat.url || contextMenuPos?.url === chat.url) && !isSelectionMode ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                        >
                          <MoreVertical size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Verlauf Sektion */}
            <div>
              <div className="flex items-center justify-between mb-2 ml-1">
                <h2 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Verlauf</h2>
                {isSelectionMode && (
                  <div className="flex gap-2 mr-2">
                    <button onClick={() => { setIsFolderPopupOpen('bulk'); (window as any).ipcRenderer.send('set-view-visibility', false); }} className="text-[var(--accent)] hover:text-blue-400 transition-colors" title="In Ordner verschieben"><Folder size={14} /></button>
                    <button onClick={() => handleRemoveFromFolder(Array.from(selectedChats))} className="text-orange-400 hover:text-orange-300 transition-colors" title="Aus Ordner entfernen"><FolderMinus size={14} /></button>
                    <button onClick={handleBulkDelete} className="text-red-400 hover:text-red-300 transition-colors" title="Löschen"><Trash2 size={14} /></button>
                    <button onClick={() => { setIsSelectionMode(false); setSelectedChats(new Set()); }} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-xs ml-1">Abbrechen</button>
                  </div>
                )}
              </div>
              <div>
                {chats.length === 0 ? (
                  <div className="text-xs text-[var(--text-secondary)] px-3 py-2">Lade Chats...</div>
                ) : (
                  chats.filter(c => !folderMap[c.url] && !c.isPinned).map((chat) => {
                    const activeChatId = activeTabId && tabUrls[activeTabId] ? getChatId(tabUrls[activeTabId]) : null;
                    const isActive = activeChatId && getChatId(chat.url) === activeChatId;
                    return (
                      <div key={chat.url}
                        onMouseEnter={() => setHoveredChat(chat.url)}
                        onMouseLeave={() => setHoveredChat(null)}
                        onClick={() => isSelectionMode ? undefined : handleChatClick(chat.url)}
                        className={`relative flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm group cursor-pointer 
                          ${isActive ? 'bg-[var(--bg-hover)] text-[var(--accent)]' : 'hover:bg-[var(--bg-hover)] text-[var(--text-primary)]'}`}>
                        {isSelectionMode ? (
                          <input type="checkbox" checked={selectedChats.has(chat.url)} onChange={(e) => {
                            const newSet = new Set(selectedChats);
                            if (e.target.checked) newSet.add(chat.url); else newSet.delete(chat.url);
                            setSelectedChats(newSet);
                          }} className="cursor-pointer shrink-0" />
                        ) : (
                          <div className="relative shrink-0 flex items-center justify-center w-5 h-5">
                            {(chat.isGem || chat.url.includes('/gem/')) ? (
                              <Sparkles size={16} className="text-[var(--accent)]" />
                            ) : (
                              <MessageSquare size={16} className={isActive ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'} />
                            )}
                            {chat.isPinned && (
                              <div className="absolute -top-1 -right-1 bg-[var(--bg-sidebar)] rounded-full p-0.5">
                                <Pin size={10} className="text-[var(--accent)]" fill="currentColor" />
                              </div>
                            )}
                          </div>
                        )}
                        <span className={`truncate flex-1 transition-all ${(hoveredChat === chat.url || contextMenuPos?.url === chat.url) && !isSelectionMode ? 'pr-7' : ''}`}>{chat.title}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            setContextMenuPos(contextMenuPos?.url === chat.url ? null : { x: rect.right, y: rect.bottom, url: chat.url });
                          }}
                          className={`absolute right-2 p-1 hover:bg-[var(--bg-main)] rounded text-[var(--text-primary)] transition-opacity ${(hoveredChat === chat.url || contextMenuPos?.url === chat.url) && !isSelectionMode ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                        >
                          <MoreVertical size={14} />
                        </button>
                      </div>
                    );
                  })
                )}
                {isLoadingMore && (
                  <div className="text-xs text-[var(--text-secondary)] px-3 py-3 text-center flex items-center justify-center gap-2">
                    <Sparkles size={12} className="animate-pulse" />
                    Lade ältere Chats...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-3 border-t border-[var(--border-color)] shrink-0">
          <button onClick={() => { setIsSettingsOpen(true); (window as any).ipcRenderer.send('set-view-visibility', false); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors text-sm text-[var(--text-primary)]">
            <Settings size={16} />
            <span>Einstellungen</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative">
        <div className="h-12 bg-[var(--bg-main)] flex items-center px-2 shadow-md z-10 space-x-1" style={{ WebkitAppRegion: 'drag' } as any}>
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            style={{ WebkitAppRegion: 'no-drag' } as any}
          >
            <Menu size={18} />
          </button>

          <div className="flex-1 flex items-center space-x-2 overflow-x-auto hide-scrollbar px-2" style={{ WebkitAppRegion: 'no-drag' } as any}>
            {tabs.map(tab => (
              <div
                key={tab.id}
                onClick={() => handleSwitchTab(tab.id)}
                className={`flex items-center group px-4 py-1.5 rounded-full text-sm font-medium cursor-pointer transition-all duration-300 max-w-[250px]
                  ${tab.active ? 'bg-[var(--bg-card)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'}`}
              >
                {tab.icon === '✨' ? (
                  <Sparkles size={14} className="mr-2 text-[var(--accent)] animate-in fade-in zoom-in duration-300" />
                ) : tab.icon?.startsWith('LETTER:') ? (
                  <div className="w-4 h-4 rounded-full bg-[var(--accent)] flex items-center justify-center text-white font-bold opacity-80 text-[10px] mr-2 animate-in fade-in zoom-in duration-300">
                    {tab.icon.split(':')[1]}
                  </div>
                ) : tab.icon ? (
                  <img src={tab.icon} alt="" className="w-4 h-4 rounded-full mr-2 animate-in fade-in zoom-in duration-300" />
                ) : tab.url && (tab.url.includes('/gem/') || tab.url.includes('/app/gem/')) ? (
                  <Sparkles size={14} className="mr-2 text-[var(--accent)] animate-in fade-in zoom-in duration-300" />
                ) : (
                  <MessageSquare size={14} className="mr-2 text-[var(--text-secondary)]" />
                )}
                <span className="truncate flex-1 max-w-[180px]">{tab.title}</span>
                <span
                  onClick={(e) => handleCloseTab(e, tab.id)}
                  className={`ml-2 p-0.5 rounded-full hover:bg-gray-500/30 ${tab.active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}
                >
                  <X size={12} />
                </span>
              </div>
            ))}
            <button onClick={handleNewTab} className="p-1.5 rounded-full hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors" title="Neuer Tab">
              <Plus size={16} />
            </button>
          </div>

          <div className="flex items-center space-x-2 px-2" style={{ WebkitAppRegion: 'no-drag' } as any}>
            <select
              value={selectedModel}
              onChange={handleModelChange}
              className="bg-[var(--bg-sidebar)] text-sm text-[var(--text-primary)] rounded-lg px-2 py-1 outline-none border border-[var(--border-color)]"
            >
              <option value="Fast">Fast</option>
              <option value="Thinking">Thinking</option>
              <option value="Pro">Pro</option>
            </select>

            <button onClick={() => (window as any).ipcRenderer.invoke('export-pdf')} title="Als PDF exportieren" className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              <Download size={16} />
            </button>
            <button title="Bildergalerie" className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              <ImageIcon size={16} />
            </button>
            <button
              title={enhancerApiKey ? "KI-Prompt Enhancer" : "In den Einstellungen aktivieren"}
              disabled={!enhancerApiKey}
              className={`p-1.5 rounded-lg transition-colors ${enhancerApiKey ? 'hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--accent)]' : 'text-gray-600 cursor-not-allowed'}`}
            >
              <Sparkles size={16} />
            </button>
            <button onClick={handleBulkDelete} title="Massenauswahl löschen" className={`p-1.5 rounded-lg transition-colors ${selectedChats.size > 0 ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300' : 'hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-red-400'}`}>
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 bg-[var(--bg-main)] relative" id="webview-container">
          <div className="absolute inset-0 flex items-center justify-center text-[var(--text-secondary)] opacity-50">
            Lade GemiDesk...
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-8 backdrop-blur-sm animate-fade-in">
          <div className="bg-[var(--bg-sidebar)] rounded-2xl border border-[var(--border-color)] w-full max-w-3xl h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-slide-in">
            <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-3">
                <Settings className="text-[var(--accent)]" />
                <h2 className="text-xl font-bold text-[var(--text-primary)]">GemiDesk Einstellungen</h2>
              </div>
              <button onClick={() => { setIsSettingsOpen(false); (window as any).ipcRenderer.send('set-view-visibility', true); }} className="p-2 rounded-full hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Modal Sidebar */}
              <div className="w-56 bg-[var(--bg-main)] border-r border-[var(--border-color)] p-4 space-y-2">
                <button
                  onClick={() => setActiveSettingsTab('general')}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${activeSettingsTab === 'general' ? 'bg-[var(--bg-card)] text-[var(--accent)] border border-[var(--border-color)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
                >
                  <Sparkles size={18} />
                  <span>Allgemein</span>
                </button>
                <button
                  onClick={() => setActiveSettingsTab('folders')}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${activeSettingsTab === 'folders' ? 'bg-[var(--bg-card)] text-[var(--accent)] border border-[var(--border-color)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
                >
                  <Folder size={18} />
                  <span>Ordner</span>
                </button>
                <button
                  onClick={() => setActiveSettingsTab('gemini')}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${activeSettingsTab === 'gemini' ? 'bg-[var(--bg-card)] text-[var(--accent)] border border-[var(--border-color)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
                >
                  <ExternalLink size={18} />
                  <span>Gemini Links</span>
                </button>
                <button
                  onClick={() => setActiveSettingsTab('gems')}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${activeSettingsTab === 'gems' ? 'bg-[var(--bg-card)] text-[var(--accent)] border border-[var(--border-color)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
                >
                  <Sparkles size={18} />
                  <span>Gems</span>
                </button>
                <button
                  onClick={() => setActiveSettingsTab('advanced')}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${activeSettingsTab === 'advanced' ? 'bg-[var(--bg-card)] text-[var(--accent)] border border-[var(--border-color)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'}`}
                >
                  <Settings size={18} />
                  <span>Erweitert</span>
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 p-8 overflow-y-auto bg-[var(--bg-sidebar)]">
                {activeSettingsTab === 'general' && (
                  <div className="space-y-8 animate-fade-in">
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-widest mb-4">Erscheinungsbild</h3>
                      <div className="settings-item" onClick={toggleTheme}>
                        <div className="flex items-center gap-4">
                          <ImageIcon className="text-[var(--text-secondary)]" />
                          <div>
                            <p className="text-sm font-medium">App Design</p>
                            <p className="text-xs text-[var(--text-secondary)] opacity-60">Zwischen hellem und dunklem Modus wechseln</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 bg-[var(--bg-main)] p-1 rounded-lg border border-[var(--border-color)]">
                          <button className={`px-3 py-1 rounded-md text-xs transition-all ${appTheme === 'light' ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>Hell</button>
                          <button className={`px-3 py-1 rounded-md text-xs transition-all ${appTheme === 'dark' ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>Dunkel</button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-widest mb-4">Chat-Verhalten</h3>
                      <div className="space-y-4">
                        <div className="settings-item">
                          <div className="flex items-center gap-4">
                            <Plus className="text-[var(--text-secondary)]" />
                            <div>
                              <p className="text-sm font-medium">Neuer Chat Verhalten</p>
                              <p className="text-xs text-[var(--text-secondary)] opacity-60">Wie Chats aus dem Verlauf geöffnet werden</p>
                            </div>
                          </div>
                          <select
                            value={tabBehavior}
                            onChange={(e) => { setTabBehavior(e.target.value as any); (window as any).ipcRenderer.invoke('set-store', 'tabBehavior', e.target.value); }}
                            className="bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[var(--accent)] text-[var(--text-primary)]"
                          >
                            <option value="new">In neuem Tab öffnen</option>
                            <option value="replace">Aktuellen Tab ersetzen</option>
                          </select>
                        </div>
                        <div className="settings-item">
                          <div className="flex items-center gap-4">
                            <Download className="text-[var(--text-secondary)]" />
                            <div>
                              <p className="text-sm font-medium">Standard-Export</p>
                              <p className="text-xs text-[var(--text-secondary)] opacity-60">Format für das Herunterladen von Chats</p>
                            </div>
                          </div>
                          <select
                            value={exportFormat}
                            onChange={(e) => { setExportFormat(e.target.value as any); (window as any).ipcRenderer.invoke('set-store', 'exportFormat', e.target.value); }}
                            className="bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[var(--accent)] text-[var(--text-primary)]"
                          >
                            <option value="pdf">PDF Dokument</option>
                            <option value="text">Klartext (TXT)</option>
                            <option value="markdown">Markdown (MD)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeSettingsTab === 'folders' && (
                  <div className="space-y-8 animate-fade-in">
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-widest mb-4">Pagination</h3>
                      <div className="settings-item">
                        <div className="flex items-center gap-4">
                          <Menu size={18} className="text-[var(--text-secondary)]" />
                          <div>
                            <p className="text-sm font-medium">Chats pro Ordner</p>
                            <p className="text-xs text-[var(--text-secondary)] opacity-60">Anzahl der Chats, die initial pro Ordner angezeigt werden</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min="5"
                            max="50"
                            step="5"
                            value={chatsPerFolderLimit}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setChatsPerFolderLimit(val);
                              (window as any).ipcRenderer.invoke('set-store', 'chatsPerFolderLimit', val);
                            }}
                            className="w-32 accent-[var(--accent)] cursor-pointer"
                          />
                          <span className="text-sm font-bold text-[var(--accent)] w-8 text-center">{chatsPerFolderLimit}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-widest mb-4">Ordner verwalten</h3>
                      <div className="flex gap-2 mb-6">
                        <input
                          type="text"
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddFolder()}
                          placeholder="Neuer Ordnername..."
                          className="input-field flex-1"
                        />
                        <button onClick={() => handleAddFolder()} className="btn-primary">
                          <Plus size={18} />
                          <span>Hinzufügen</span>
                        </button>
                      </div>

                      <div className="space-y-3">
                        {folders.filter(f => !f.parentId).map(f => renderSettingsFolder(f))}
                      </div>
                    </div>
                  </div>
                )}

                {activeSettingsTab === 'gemini' && (
                  <div className="space-y-4 animate-fade-in">
                    <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-widest mb-4">Gemini-Verknüpfungen</h3>
                    <div className="grid grid-cols-1 gap-3">
                      {[
                        'Anweisungen für Gemini', 'Verbundene Apps', 'Geplante Aktionen',
                        'Meine öffentlichen Links', 'Abo verwalten',
                        'Gems verwalten', 'NotebookLM', 'Hilfe'
                      ].map(item => (
                        <button key={item} onClick={() => handleGeminiLink(item)} className="settings-item group">
                          <span className="text-sm">{item}</span>
                          <ExternalLink size={14} className="text-[var(--text-secondary)] group-hover:text-[var(--accent)]" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {activeSettingsTab === 'gems' && (
                  <div className="space-y-6 animate-fade-in">
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-widest mb-4">Gemini Gems</h3>
                      <div className="settings-item" onClick={() => handleGeminiLink('Gems verwalten')}>
                        <div className="flex items-center gap-4">
                          <Sparkles className="text-[var(--accent)]" />
                          <div>
                            <p className="text-sm font-medium">Gems verwalten</p>
                            <p className="text-xs text-[var(--text-secondary)] opacity-60">Erstelle und bearbeite deine persönlichen KI-Personas</p>
                          </div>
                        </div>
                        <ExternalLink size={16} className="text-[var(--text-secondary)]" />
                      </div>
                    </div>

                    {gems.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Deine Gems</h3>
                        <div className="grid grid-cols-2 gap-3">
                          {gems.map(gem => (
                            <button
                              key={gem.url}
                              onClick={() => { handleChatClick(gem.url); setIsSettingsOpen(false); (window as any).ipcRenderer.send('set-view-visibility', true); }}
                              className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] hover:border-[var(--accent)] transition-all text-left"
                            >
                              {gem.iconUrl === '✨' ? <Sparkles size={16} className="text-[var(--accent)]" /> :
                                gem.iconUrl?.startsWith('LETTER:') ? (
                                  <div className="w-6 h-6 rounded-full bg-[var(--accent)] flex items-center justify-center text-white font-bold opacity-80 text-xs">
                                    {gem.iconUrl.split(':')[1]}
                                  </div>
                                ) :
                                  gem.iconUrl ? <img src={gem.iconUrl} className="w-6 h-6 rounded-full" /> : <Sparkles size={16} className="text-[var(--accent)]" />}
                              <span className="text-sm font-medium truncate">{gem.title}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {activeSettingsTab === 'advanced' && (
                  <div className="space-y-8 animate-fade-in">
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-widest mb-4">GemiDesk API</h3>
                      <div className="space-y-4">
                        <div className="settings-item flex-col items-start gap-4">
                          <div className="flex items-center gap-4 w-full">
                            <Sparkles className="text-[var(--text-secondary)]" />
                            <div className="flex-1">
                              <p className="text-sm font-medium">Enhancer API Key</p>
                              <p className="text-xs text-[var(--text-secondary)] opacity-60">Premium Prompt-Optimierung aktivieren</p>
                            </div>
                          </div>
                          <input
                            type="password"
                            value={enhancerApiKey}
                            onChange={(e) => { setEnhancerApiKey(e.target.value); (window as any).ipcRenderer.invoke('set-store', 'enhancerApiKey', e.target.value); }}
                            placeholder="API-Key hier einfügen..."
                            className="input-field"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-widest mb-4">Developer Tools</h3>
                      <div className="settings-item">
                        <div className="flex items-center gap-4">
                          <Settings className="text-[var(--text-secondary)]" />
                          <div>
                            <p className="text-sm font-medium">Developer Mode</p>
                            <p className="text-xs text-[var(--text-secondary)] opacity-60">Aktiviere DevTools für die Gemini-Webview</p>
                          </div>
                        </div>
                        <div
                          className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out ${isDevMode ? 'bg-[var(--accent)]' : 'bg-gray-600'}`}
                          onClick={() => {
                            const newState = !isDevMode;
                            setIsDevMode(newState);
                            (window as any).ipcRenderer.invoke('set-store', 'devMode', newState);
                            (window as any).ipcRenderer.send('toggle-dev-mode', newState);
                          }}
                        >
                          <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ease-in-out transform ${isDevMode ? 'translate-x-6' : 'translate-x-0'}`} />
                        </div>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Folder Selection Popup */}
      {isFolderPopupOpen && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4 animate-fade-in" onClick={() => { setIsFolderPopupOpen(null); (window as any).ipcRenderer.send('set-view-visibility', true); }}>
          <div className="bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-2xl shadow-2xl p-3 w-72 animate-slide-in" onClick={e => e.stopPropagation()}>
            <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest px-3 py-3 border-b border-[var(--border-color)] mb-2">In Ordner verschieben</h3>
            <div className="space-y-1">
              {folders.map(f => (
                <button key={f.id} onClick={() => handleMoveToFolder(f.id)} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] hover:text-[var(--accent)] rounded-xl transition-all">
                  <Folder size={16} />
                  <span>{f.name}</span>
                </button>
              ))}
              <button onClick={() => { setIsSettingsOpen(true); setIsFolderPopupOpen(null); setActiveSettingsTab('folders'); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all border-t border-[var(--border-color)] mt-2 pt-3">
                <Plus size={16} />
                <span>Neuen Ordner erstellen</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Folder Nesting Selection Popup */}
      {movingFolderId && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4 animate-fade-in" onClick={() => setMovingFolderId(null)}>
          <div className="bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-2xl shadow-2xl p-3 w-72 animate-slide-in" onClick={e => e.stopPropagation()}>
            <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest px-3 py-3 border-b border-[var(--border-color)] mb-2">Übergeordneten Ordner wählen</h3>
            <div className="space-y-1 max-h-96 overflow-y-auto hide-scrollbar">
              <button
                onClick={() => handleMoveFolderToParent(movingFolderId, undefined)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] hover:text-[var(--accent)] rounded-xl transition-all"
              >
                <div className="w-4 h-4 border-2 border-dashed border-[var(--border-color)] rounded-sm" />
                <span>Hauptmenü (Root)</span>
              </button>
              {folders.filter(f => f.id !== movingFolderId).map(f => (
                <button
                  key={f.id}
                  onClick={() => handleMoveFolderToParent(movingFolderId, f.id)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)] hover:text-[var(--accent)] rounded-xl transition-all"
                >
                  <Folder size={16} />
                  <span>{f.name}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setMovingFolderId(null)}
              className="w-full text-center py-2 mt-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenuPos && (
        <div
          className="fixed z-[80] w-52 bg-[var(--bg-card)] rounded-xl shadow-2xl border border-[var(--border-color)] py-2 animate-fade-in"
          style={{
            top: `${Math.min(contextMenuPos.y + 4, window.innerHeight - 240)}px`,
            left: `${Math.max(8, contextMenuPos.x - 208)}px`
          }}
          onMouseEnter={() => setIsHoveringMenu(true)}
          onMouseLeave={() => setIsHoveringMenu(false)}
        >
          <button onClick={() => { setIsSelectionMode(true); setContextMenuPos(null); }} className="w-full text-left px-4 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-hover)] hover:text-[var(--accent)] flex items-center gap-3"><CheckSquare size={14} /> Auswählen</button>
          <button onClick={() => { setIsFolderPopupOpen(contextMenuPos.url); setContextMenuPos(null); (window as any).ipcRenderer.send('set-view-visibility', false); }} className="w-full text-left px-4 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-hover)] hover:text-[var(--accent)] flex items-center gap-3"><Folder size={14} /> In Ordner verschieben</button>
          {folderMap[contextMenuPos.url] && (
            <button onClick={() => { handleRemoveFromFolder([contextMenuPos.url]); setContextMenuPos(null); }} className="w-full text-left px-4 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-hover)] hover:text-red-400 flex items-center gap-3"><FolderMinus size={14} /> Aus Ordner entfernen</button>
          )}
          {chats.find(c => c.url === contextMenuPos.url)?.isPinned ? (
            <button onClick={() => { (window as any).ipcRenderer.send('toggle-pin-chat', contextMenuPos.url); setContextMenuPos(null); }} className="w-full text-left px-4 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-hover)] hover:text-[var(--accent)] flex items-center gap-3"><PinOff size={14} /> Loslösen</button>
          ) : (
            <button onClick={() => { (window as any).ipcRenderer.send('toggle-pin-chat', contextMenuPos.url); setContextMenuPos(null); }} className="w-full text-left px-4 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-hover)] hover:text-[var(--accent)] flex items-center gap-3"><Pin size={14} /> Anpinnen</button>
          )}
          <button onClick={() => { handleOpenInNewTab(contextMenuPos.url); setContextMenuPos(null); }} className="w-full text-left px-4 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-hover)] hover:text-[var(--accent)] flex items-center gap-3 border-t border-[var(--border-color)] mt-1 pt-2"><Plus size={14} /> In neuem Tab öffnen</button>
        </div>
      )}
    </div>
  );
}
