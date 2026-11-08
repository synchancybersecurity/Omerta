import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { vaultDelete, vaultGet, vaultSet } from '@omerta/vault-store';
import type { Conversation, Message, OpenChatMessage } from '@omerta/types';

const INITIAL_CONVERSATIONS: Conversation[] = [];
const INITIAL_OPEN_CHAT: OpenChatMessage[] = [];

export interface ThemeSettings {
  darkMode: boolean;
  accentHue: number;
  accentSat: number;
  bgDarkness: number;
  panelBrightness: number;
  textBrightness: number;
  sentBubbleTint: number;
  receivedBubbleTint: number;
  borderOpacity: number;
  outlineWidth: number;
  msgTextBrightness: number;
  bgSaturation: number;
  panelSaturation: number;
}

const DEFAULT_THEME: ThemeSettings = {
  darkMode: true,
  accentHue: 0,
  accentSat: 84,
  bgDarkness: 4,
  panelBrightness: 6,
  textBrightness: 94,
  sentBubbleTint: 0,
  receivedBubbleTint: 0,
  borderOpacity: 20,
  outlineWidth: 1,
  msgTextBrightness: 94,
  bgSaturation: 0,
  panelSaturation: 0,
};

function loadTheme(): ThemeSettings {
  try {
    const raw = localStorage.getItem('omerta_theme');
    if (raw) return { ...DEFAULT_THEME, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_THEME };
}

interface UnreadCounts {
  message: number;
  chat: number;
  sms: number;
  contacts: number;
}

interface AppContextValue {
  isAuthenticated: boolean;
  userHandle: string;
  activeConversationId: string | null;
  conversations: Conversation[];
  mobileSidebarOpen: boolean;
  openChatMessages: OpenChatMessage[];
  login: (handle: string) => void;
  logout: () => void;
  setActiveConversation: (id: string) => void;
  sendMessage: (content: string, burnAfterRead?: boolean, isEmojiEncrypted?: boolean, isE2EEncrypted?: boolean, replyTo?: { id: string; content: string }) => void;
  markAsRead: (id: string) => void;
  toggleMobileSidebar: () => void;
  burnMessage: (convId: string, msgId: string) => void;
  editMessage: (convId: string, msgId: string, newContent: string) => void;
  deleteMessage: (convId: string, msgId: string) => void;
  sendOpenChatMessage: (content: string, emojiEncrypt?: boolean, e2eEncrypt?: boolean) => void;
  editProfile: (handle: string) => void;
  userRole: 'basic' | 'moderator' | 'admin';
  setUserRole: (role: 'basic' | 'moderator' | 'admin') => void;
  toggleAdmin: () => void;
  theme: ThemeSettings;
  updateTheme: (updates: Partial<ThemeSettings>) => void;
  resetTheme: () => void;
  selectedAvatar: string | null;
  setSelectedAvatar: (avatar: string | null) => void;
  unreadCounts: UnreadCounts;
  clearUnread: (tab: keyof UnreadCounts) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  viewingProfile: string | null;
  setViewingProfile: (handle: string | null) => void;
  requestNotificationPermission: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userHandle, setUserHandle] = useState('');
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [openChatMessages, setOpenChatMessages] = useState<OpenChatMessage[]>(INITIAL_OPEN_CHAT);
  const [userRole, setUserRole] = useState<'basic' | 'moderator' | 'admin'>('basic');
  const [theme, setTheme] = useState<ThemeSettings>(loadTheme);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem('omerta_avatar');
      if (saved && !saved.startsWith('data:')) return saved;
      return null;
    } catch { return null; }
  });
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({
    message: 0, chat: 0, sms: 0, contacts: 0,
  });
  const [activeTab, setActiveTab] = useState('profile');
  const [viewingProfile, setViewingProfile] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Browser notification permission
  const requestNotificationPermission = useCallback(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(p => {
        setNotificationsEnabled(p === 'granted');
      });
    } else if ('Notification' in window && Notification.permission === 'granted') {
      setNotificationsEnabled(true);
    }
  }, []);

  // Send browser notification
  const sendNotification = useCallback((title: string, body: string) => {
    if (notificationsEnabled && 'Notification' in window && document.hidden) {
      new Notification(title, { body, icon: '/logo.jpg' });
    }
  }, [notificationsEnabled]);

  // Increment unread for a tab
  const incrementUnread = useCallback((tab: keyof UnreadCounts) => {
    setUnreadCounts(prev => ({ ...prev, [tab]: prev[tab] + 1 }));
  }, []);

  // Clear unread for a tab
  const clearUnread = useCallback((tab: keyof UnreadCounts) => {
    setUnreadCounts(prev => ({ ...prev, [tab]: 0 }));
  }, []);

  // Track active tab changes — clear unread for that tab
  useEffect(() => {
    const tabMap: Record<string, keyof UnreadCounts> = {
      message: 'message', chat: 'chat', sms: 'sms', contacts: 'contacts',
    };
    if (tabMap[activeTab]) clearUnread(tabMap[activeTab]);
  }, [activeTab, clearUnread]);

  // Live socket is not used in this preview. Unread badges stay local.
  useEffect(() => {
    if (!isAuthenticated) return;
  }, [isAuthenticated]);

  // Apply theme CSS custom properties
  useEffect(() => {
    const root = document.documentElement;
    const isDark = theme.darkMode;
    const primaryH = theme.accentHue;
    const primaryS = theme.accentSat;
    const primaryL = 42;
    const borderOp = theme.borderOpacity;
    const outlineW = theme.outlineWidth;

    if (isDark) {
      const bg = theme.bgDarkness;
      const bgSat = theme.bgSaturation;
      const panel = Math.min(bg + theme.panelBrightness * 0.5, 20);
      const panelSat = theme.panelSaturation;
      const text = theme.textBrightness;
      const msgText = theme.msgTextBrightness;

      root.style.setProperty('--background', `${primaryH} ${bgSat}% ${bg}%`);
      root.style.setProperty('--foreground', `0 0% ${text}%`);
      root.style.setProperty('--card', `${primaryH} ${panelSat}% ${panel}%`);
      root.style.setProperty('--card-foreground', `0 0% ${text}%`);
      root.style.setProperty('--popover', `${primaryH} ${panelSat}% ${panel}%`);
      root.style.setProperty('--popover-foreground', `0 0% ${text}%`);
      root.style.setProperty('--primary', `${primaryH} ${primaryS}% ${primaryL}%`);
      root.style.setProperty('--primary-foreground', `0 0% 100%`);
      root.style.setProperty('--secondary', `${primaryH} ${panelSat}% ${Math.min(panel + 3, 25)}%`);
      root.style.setProperty('--secondary-foreground', `0 0% ${text}%`);
      root.style.setProperty('--muted', `${primaryH} ${panelSat}% ${Math.min(panel + 2, 22)}%`);
      root.style.setProperty('--muted-foreground', `0 0% ${Math.max(text - 40, 30)}%`);
      root.style.setProperty('--accent', `${primaryH} ${primaryS}% ${primaryL}%`);
      root.style.setProperty('--accent-foreground', `0 0% 100%`);
      root.style.setProperty('--destructive', `${primaryH} ${Math.max(primaryS - 20, 50)}% ${primaryL - 10}%`);
      root.style.setProperty('--destructive-foreground', `0 0% ${text}%`);
      root.style.setProperty('--border', `${primaryH} ${Math.max(panelSat - 5, 0)}% ${Math.min(panel + 5, 30)}%`);
      root.style.setProperty('--input', `${primaryH} ${panelSat}% ${Math.min(panel + 3, 25)}%`);
      root.style.setProperty('--ring', `${primaryH} ${primaryS}% ${primaryL}%`);
      root.style.setProperty('--sidebar-background', `${primaryH} ${bgSat}% ${Math.max(bg - 1, 2)}%`);
      root.style.setProperty('--sidebar-foreground', `0 0% ${text}%`);
      root.style.setProperty('--sidebar-primary', `${primaryH} ${primaryS}% ${primaryL}%`);
      root.style.setProperty('--sidebar-primary-foreground', `0 0% 100%`);
      root.style.setProperty('--sidebar-accent', `${primaryH} ${panelSat}% ${Math.min(panel + 2, 20)}%`);
      root.style.setProperty('--sidebar-accent-foreground', `0 0% ${text}%`);
      root.style.setProperty('--sidebar-border', `${primaryH} ${Math.max(panelSat - 5, 0)}% ${Math.min(panel + 4, 28)}%`);
      root.style.setProperty('--sidebar-ring', `${primaryH} ${primaryS}% ${primaryL}%`);

      const sentTint = theme.sentBubbleTint;
      const recvTint = theme.receivedBubbleTint;
      root.style.setProperty('--bubble-sent-bg', `${primaryH} ${Math.max(primaryS - sentTint * 0.5, 10)}% ${Math.min(panel + sentTint * 0.15, 18)}%`);
      root.style.setProperty('--bubble-sent-border', `${primaryH} ${primaryS}% ${primaryL}% / ${borderOp / 100}`);
      root.style.setProperty('--bubble-sent-outline', `${outlineW}px`);
      root.style.setProperty('--bubble-recv-bg', `0 ${Math.max(panelSat - recvTint * 0.3, 0)}% ${Math.min(panel + recvTint * 0.1, 16)}%`);
      root.style.setProperty('--bubble-recv-border', `0 0% ${Math.min(panel + 10, 35)}% / ${borderOp / 100}`);
      root.style.setProperty('--bubble-recv-outline', `${outlineW}px`);
      root.style.setProperty('--bubble-text', `0 0% ${msgText}%`);
      root.style.setProperty('--bubble-meta', `0 0% ${Math.max(msgText - 30, 35)}%`);
      root.style.setProperty('--action-bar-border', `0 0% ${Math.min(panel + 8, 30)}% / ${borderOp / 100}`);
      root.style.setProperty('--reply-quote-bg', `${primaryH} ${Math.max(primaryS - 40, 5)}% ${Math.min(panel + 2, 15)}% / 0.5`);
      root.style.setProperty('--reply-quote-border', `${primaryH} ${primaryS}% ${primaryL}% / ${Math.max(borderOp - 10, 5) / 100}`);
    } else {
      // Light mode: swap to light palette with same accent
      const bg = 96;
      const panel = Math.max(88, 96 - theme.panelBrightness * 0.5);
      const text = Math.max(8, 100 - theme.textBrightness);
      const msgText = Math.max(15, 100 - theme.msgTextBrightness);

      root.style.setProperty('--background', `${primaryH} ${theme.bgSaturation * 0.3}% ${bg}%`);
      root.style.setProperty('--foreground', `0 0% ${text}%`);
      root.style.setProperty('--card', `${primaryH} ${theme.panelSaturation * 0.3}% ${panel}%`);
      root.style.setProperty('--card-foreground', `0 0% ${text}%`);
      root.style.setProperty('--popover', `${primaryH} ${theme.panelSaturation * 0.3}% ${panel}%`);
      root.style.setProperty('--popover-foreground', `0 0% ${text}%`);
      root.style.setProperty('--primary', `${primaryH} ${primaryS}% ${primaryL}%`);
      root.style.setProperty('--primary-foreground', `0 0% 100%`);
      root.style.setProperty('--secondary', `${primaryH} ${theme.panelSaturation * 0.3}% ${Math.max(panel - 5, 80)}%`);
      root.style.setProperty('--secondary-foreground', `0 0% ${text}%`);
      root.style.setProperty('--muted', `${primaryH} ${theme.panelSaturation * 0.3}% ${Math.max(panel - 8, 78)}%`);
      root.style.setProperty('--muted-foreground', `0 0% ${Math.min(text + 45, 55)}%`);
      root.style.setProperty('--accent', `${primaryH} ${primaryS}% ${primaryL}%`);
      root.style.setProperty('--accent-foreground', `0 0% 100%`);
      root.style.setProperty('--destructive', `0 65% 50%`);
      root.style.setProperty('--destructive-foreground', `0 0% 100%`);
      root.style.setProperty('--border', `${primaryH} ${Math.max(theme.panelSaturation * 0.3 - 2, 0)}% ${Math.max(panel - 15, 70)}%`);
      root.style.setProperty('--input', `${primaryH} ${theme.panelSaturation * 0.3}% ${Math.max(panel - 5, 80)}%`);
      root.style.setProperty('--ring', `${primaryH} ${primaryS}% ${primaryL}%`);
      root.style.setProperty('--sidebar-background', `${primaryH} ${theme.bgSaturation * 0.3}% ${Math.max(bg - 2, 92)}%`);
      root.style.setProperty('--sidebar-foreground', `0 0% ${text}%`);
      root.style.setProperty('--sidebar-primary', `${primaryH} ${primaryS}% ${primaryL}%`);
      root.style.setProperty('--sidebar-primary-foreground', `0 0% 100%`);
      root.style.setProperty('--sidebar-accent', `${primaryH} ${theme.panelSaturation * 0.3}% ${Math.max(panel - 5, 82)}%`);
      root.style.setProperty('--sidebar-accent-foreground', `0 0% ${text}%`);
      root.style.setProperty('--sidebar-border', `${primaryH} ${Math.max(theme.panelSaturation * 0.3 - 2, 0)}% ${Math.max(panel - 12, 75)}%`);
      root.style.setProperty('--sidebar-ring', `${primaryH} ${primaryS}% ${primaryL}%`);

      root.style.setProperty('--bubble-sent-bg', `${primaryH} ${Math.max(primaryS - theme.sentBubbleTint * 0.3, 5)}% ${Math.max(85, 96 - theme.sentBubbleTint * 0.08)}%`);
      root.style.setProperty('--bubble-sent-border', `${primaryH} ${primaryS}% ${primaryL}% / ${borderOp / 100}`);
      root.style.setProperty('--bubble-sent-outline', `${outlineW}px`);
      root.style.setProperty('--bubble-recv-bg', `0 0% ${Math.max(90, 96 - theme.receivedBubbleTint * 0.06)}%`);
      root.style.setProperty('--bubble-recv-border', `0 0% ${Math.max(panel - 20, 65)}% / ${borderOp / 100}`);
      root.style.setProperty('--bubble-recv-outline', `${outlineW}px`);
      root.style.setProperty('--bubble-text', `0 0% ${msgText}%`);
      root.style.setProperty('--bubble-meta', `0 0% ${Math.min(msgText + 30, 60)}%`);
      root.style.setProperty('--action-bar-border', `0 0% ${Math.max(panel - 25, 60)}% / ${borderOp / 100}`);
      root.style.setProperty('--reply-quote-bg', `${primaryH} ${Math.max(primaryS - 50, 3)}% ${Math.max(panel - 10, 80)}% / 0.5`);
      root.style.setProperty('--reply-quote-border', `${primaryH} ${primaryS}% ${primaryL}% / ${Math.max(borderOp - 10, 5) / 100}`);
    }

    root.setAttribute('data-theme', isDark ? 'dark' : 'light');

    localStorage.setItem('omerta_theme', JSON.stringify(theme));
  }, [theme]);

  // Auto-save settings to server (debounced)
  const saveSettingsToServer = useCallback((newTheme: ThemeSettings, newAvatar: string | null) => {
    if (!userHandle) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      fetch('/api/settings/' + encodeURIComponent(userHandle), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: newTheme, avatar: newAvatar }),
      }).catch(() => { /* silently fail */ });
    }, 1000);
  }, [userHandle]);

  // Load settings from server on login
  const loadSettingsFromServer = useCallback(async (handle: string) => {
    try {
      const res = await fetch('/api/settings/' + encodeURIComponent(handle));
      const data = await res.json();
      if (data && data.theme) {
        setTheme(prev => ({ ...prev, ...data.theme }));
      }
      if (data && data.avatar) {
        setSelectedAvatar(data.avatar);
        if (String(data.avatar).startsWith('data:')) {
          void vaultSet('avatar', data.avatar).catch(() => {});
          try { localStorage.removeItem('omerta_avatar'); } catch { /* ignore */ }
        } else {
          try { localStorage.setItem('omerta_avatar', data.avatar); } catch { /* ignore */ }
        }
      }
    } catch { /* silently fail — use localStorage */ }
  }, []);

  const updateTheme = useCallback((updates: Partial<ThemeSettings>) => {
    setTheme(prev => {
      const next = { ...prev, ...updates };
      saveSettingsToServer(next, selectedAvatar);
      return next;
    });
  }, [saveSettingsToServer, selectedAvatar]);

  const resetTheme = useCallback(() => {
    setTheme({ ...DEFAULT_THEME });
    saveSettingsToServer(DEFAULT_THEME, selectedAvatar);
  }, [saveSettingsToServer, selectedAvatar]);

  useEffect(() => {
    const saved = (() => { try { return localStorage.getItem('omerta_avatar'); } catch { return null; } })();
    if (saved && saved.startsWith('data:')) {
      setSelectedAvatar(saved);
      void vaultSet('avatar', saved).then(() => { try { localStorage.removeItem('omerta_avatar'); } catch { /* already clear */ } });
      return;
    }
    if (!saved) {
      void vaultGet('avatar').then((picture) => { if (picture) setSelectedAvatar(picture); }).catch(() => {});
    }
  }, []);

  const setAvatar = useCallback((avatar: string | null) => {
    setSelectedAvatar(avatar);
    if (!avatar) {
      try { localStorage.removeItem('omerta_avatar'); } catch { /* ignore */ }
      void vaultDelete('avatar').catch(() => {});
    } else if (avatar.startsWith('data:')) {
      try { localStorage.removeItem('omerta_avatar'); } catch { /* ignore */ }
      void vaultSet('avatar', avatar).catch(() => {});
    } else {
      try { localStorage.setItem('omerta_avatar', avatar); } catch { /* ignore */ }
      void vaultDelete('avatar').catch(() => {});
    }
    saveSettingsToServer(theme, avatar);
  }, [saveSettingsToServer, theme]);

  const login = useCallback((handle: string) => {
    setUserHandle(handle || 'ANON_' + Math.floor(Math.random() * 9999));
    setIsAuthenticated(true);
    loadSettingsFromServer(handle);
    requestNotificationPermission();
  }, [loadSettingsFromServer, requestNotificationPermission]);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setUserHandle('');
    setActiveConversationId(null);
    setConversations(INITIAL_CONVERSATIONS);
    setOpenChatMessages(INITIAL_OPEN_CHAT);
    setUserRole('basic');
    setUserRole('basic');
    setUnreadCounts({ message: 0, chat: 0, sms: 0, contacts: 0 });
  }, []);

  const setActiveConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    setConversations(prev => prev.map(c => c.id === id ? { ...c, unread: 0 } : c));
    setMobileSidebarOpen(false);
  }, []);

  const sendMessage = useCallback((content: string, burnAfterRead = false, isEmojiEncrypted = false, isE2EEncrypted = false, replyTo?: { id: string; content: string; sender?: string }) => {
    if (!activeConversationId || !content.trim()) return;
    const newMessage: Message = {
      id: 'm' + Date.now(),
      content: content.trim(),
      sender: 'me',
      timestamp: Date.now(),
      isSent: true,
      burnAfterRead,
      isBurned: false,
      isSystem: false,
      isEmojiEncrypted,
      isE2EEncrypted,
      replyTo: replyTo?.id,
      replyContent: replyTo?.content,
      replySender: replyTo?.sender,
    };
    setConversations(prev => prev.map(c => {
      if (c.id !== activeConversationId) return c;
      return {
        ...c,
        lastMessage: newMessage.content,
        timestamp: newMessage.timestamp,
        messages: [...c.messages, newMessage],
      };
    }));
  }, [activeConversationId]);

  const sendOpenChatMessage = useCallback((content: string, emojiEncrypt = false, e2eEncrypt = false) => {
    if (!content.trim()) return;
    const msg: OpenChatMessage = {
      id: 'oc' + Date.now(),
      content: content.trim(),
      sender: userHandle || 'ANON',
      senderColor: '#B91C1C',
      timestamp: Date.now(),
      isEmojiEncrypted: emojiEncrypt,
      isE2EEncrypted: e2eEncrypt,
    };
    setOpenChatMessages(prev => [...prev, msg]);
  }, [userHandle]);

  const markAsRead = useCallback((id: string) => {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, unread: 0 } : c));
  }, []);

  const toggleMobileSidebar = useCallback(() => {
    setMobileSidebarOpen(prev => !prev);
  }, []);

  const burnMessage = useCallback((convId: string, msgId: string) => {
    setConversations(prev => prev.map(c => {
      if (c.id !== convId) return c;
      return {
        ...c,
        messages: c.messages.map(m => m.id === msgId ? { ...m, isBurned: true, content: '// BURNED //' } : m),
      };
    }));
  }, []);

  const editMessage = useCallback((convId: string, msgId: string, newContent: string) => {
    setConversations(prev => prev.map(c => {
      if (c.id !== convId) return c;
      return {
        ...c,
        messages: c.messages.map(m => m.id === msgId ? { ...m, content: newContent, edited: true } : m),
      };
    }));
  }, []);

  const deleteMessage = useCallback((convId: string, msgId: string) => {
    setConversations(prev => prev.map(c => {
      if (c.id !== convId) return c;
      return {
        ...c,
        messages: c.messages.map(m => m.id === msgId ? { ...m, deleted: true, content: '// DELETED //' } : m),
      };
    }));
  }, []);

  const editProfile = useCallback((handle: string) => {
    setUserHandle(handle);
  }, []);

  const toggleAdmin = useCallback(() => {
    setUserRole(prev => prev === 'admin' ? 'basic' : prev === 'moderator' ? 'admin' : 'moderator');
  }, []);

  const value: AppContextValue = {
    isAuthenticated,
    userHandle,
    activeConversationId,
    conversations,
    mobileSidebarOpen,
    openChatMessages,
    login,
    logout,
    setActiveConversation,
    sendMessage,
    markAsRead,
    toggleMobileSidebar,
    burnMessage,
    editMessage,
    deleteMessage,
    sendOpenChatMessage,
    editProfile,
    userRole,
    setUserRole,
    toggleAdmin,
    theme,
    updateTheme,
    resetTheme,
    selectedAvatar,
    setSelectedAvatar: setAvatar,
    unreadCounts,
    clearUnread,
    activeTab,
    setActiveTab,
    viewingProfile,
    setViewingProfile,
    requestNotificationPermission,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
