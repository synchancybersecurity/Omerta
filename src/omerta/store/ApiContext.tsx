import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { cue } from '@omerta/utils/cue';
import { useApp } from '@omerta/store/AppContext';

interface Reply {
  id: string;
  post_id: string;
  author: string;
  content: string;
  timestamp: number;
}

interface UserProfile {
  handle: string;
  created_at: number;
  avatar: string | null;
  role?: string;
}

interface ApiContextValue {
  wsConnected: boolean;
  wsError: string | null;
  conversations: Array<{
    id: number;
    user1_handle: string;
    user2_handle: string;
    last_message: string | null;
    last_timestamp: number | null;
    unread: number;
  }>;
  openChatMessages: Array<{
    id: number;
    sender_handle: string;
    content: string;
    timestamp: number;
    emoji_encrypted: number;
    e2e_encrypted: number;
    system?: number;
    reply_to?: number | null;
    reply_content?: string | null;
    reply_sender?: string | null;
  }>;
  messages: Record<number, Array<{
    id: number;
    sender_handle: string;
    content: string;
    timestamp: number;
    burn_after_read: number;
    is_burned: number;
    emoji_encrypted: number;
    e2e_encrypted: number;
    system?: number;
    reply_to?: string | null;
    reply_content?: string | null;
    reply_sender?: string | null;
  }>>;
  posts: Array<{
    id: string;
    author: string;
    author_handle: string;
    author_avatar?: string | null;
    content: string;
    emoji_encrypted: number;
    timestamp: number;
    likes: number;
    dislikes: number;
    comments: number;
    shares: number;
    is_burned: number;
    burn_after: number;
    liked_by?: string[];
    disliked_by?: string[];
  }>;
  replies: Record<string, Reply[]>;
  smsMessages: Array<{
    id: number;
    sender_handle: string;
    recipient: string;
    content: string;
    timestamp: number;
    burn_after_read: number;
    is_burned: number;
  }>;
  searchResults: Array<{ id: number; handle: string; created_at: number }>;
  fetchConversations: (handle: string) => Promise<void>;
  createConversation: (user1: string, user2: string) => Promise<{ id: number } | null>;
  fetchOpenChat: () => Promise<void>;
  fetchMessages: (conversationId: number) => Promise<void>;
  sendPrivateMessage: (conversationId: number, sender: string, content: string, burnAfterRead?: boolean, emojiEncrypted?: boolean, e2eEncrypted?: boolean, replyTo?: string | null, replyContent?: string | null, replySender?: string | null) => Promise<void>;
  sendOpenChatMessage: (sender: string, content: string, emojiEncrypted?: boolean, e2eEncrypted?: boolean, replyTo?: number | null, replyContent?: string | null, replySender?: string | null) => Promise<void>;
  burnMessage: (messageId: number) => Promise<void>;
  searchUsers: (query: string) => Promise<{ id: number; handle: string; created_at: number }[]>;
  fetchAllUsers: () => Promise<{ id: number; handle: string; created_at: number }[]>;
  fetchSMS: (handle: string) => Promise<void>;
  sendSMS: (sender: string, recipient: string, content: string, burnAfterRead?: boolean) => Promise<void>;
  burnSMS: (messageId: number) => Promise<void>;
  uploadFile: (file: File) => Promise<{ url?: string; error?: string } | null>;
  fetchEscrows: (handle: string) => Promise<void>;
  createEscrow: (sender: string, recipient: string, amount: number, description: string) => Promise<{ id?: string } | null>;
  updateEscrow: (id: string, action: 'release' | 'dispute' | 'cancel') => Promise<void>;
  resolveEscrow: (id: string, resolution: 'released' | 'refunded' | 'disputed', adminHandle: string, note?: string) => Promise<void>;
  fetchAllEscrows: () => Promise<void>;
  escrows: Array<{ id: string; sender: string; recipient: string; amount: number; house_fee?: number; net_amount?: number; house_fee_percent?: number; description: string; status: string; created_at: number; resolved_at?: number | null; resolved_by?: string | null; resolution_note?: string | null }>;
  houseSettings: { holdingWallet: string; feeWallet: string; houseFeePercent: number; chain?: string; houseAddress?: string; payouts?: string[]; deposits?: Array<{ id: string; source: string; source_id: string; gross: number; amount: number; wallet: string; timestamp: number }>; payments?: Array<{ id: string; source: string; source_id: string; payer: string; amount: number; wallet: string; chain: string; status: string; tx: string; timestamp: number }> };
  fetchHouseSettings: () => Promise<void>;
  saveHouseSettings: (settings: { feeWallet?: string; chain?: string; payout?: string; actor?: string }) => Promise<{ error?: string } | null | void>;
  searchMessages: (handle: string, query: string) => Promise<Array<Record<string, unknown>>>;
  chatRooms: Array<{ id: string; name: string; creator_handle: string; creator_role?: string; is_locked: number; password?: string | null; locked_by?: string | null; lock_reason?: string | null; created_at: number }>;
  roomMessages: Array<{ id: number; room_id: string; sender_handle: string; content: string; timestamp: number; emoji_encrypted: number; e2e_encrypted: number; system?: number; reply_to?: number | null; reply_content?: string | null; reply_sender?: string | null }>;
  activeRoomId: string | null;
  setActiveRoomId: (id: string | null) => void;
  fetchChatRooms: () => Promise<void>;
  createChatRoom: (name: string, creatorHandle: string, role?: string, isLocked?: boolean, password?: string | null) => Promise<{ id: string } | { error: string } | null>;
  deleteChatRoom: (roomId: string) => Promise<void>;
  lockChatRoom: (roomId: string, lockedBy: string, reason?: string) => Promise<void>;
  unlockChatRoom: (roomId: string) => Promise<void>;
  fetchRoomMessages: (roomId: string) => Promise<void>;
  sendRoomMessage: (roomId: string, sender: string, content: string, emojiEncrypted?: boolean, e2eEncrypted?: boolean, replyTo?: number | null, replyContent?: string | null, replySender?: string | null) => Promise<void>;
  fetchPosts: () => Promise<void>;
  captures: Array<{ id: string; handle: string; kind: "screenshot" | "recording"; timestamp: number }>;
  reportCapture: (handle: string, kind: "screenshot" | "recording") => Promise<void>;
  createPost: (author: string, authorHandle: string, content: string, emojiEncrypted?: boolean, burnAfter?: boolean, authorAvatar?: string | null) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  likePost: (postId: string, userHandle: string) => Promise<void>;
  dislikePost: (postId: string, userHandle: string) => Promise<void>;
  sharePost: (postId: string) => Promise<void>;
  fetchReplies: (postId: string) => Promise<void>;
  createReply: (postId: string, author: string, content: string) => Promise<void>;
  userProfiles: Record<string, UserProfile>;
  fetchUserProfile: (handle: string) => Promise<UserProfile | null>;
  auth: (handle: string, passphrase: string) => Promise<{ success: boolean; error?: string; code?: string; role?: string; handle?: string }>;
  register: (handle: string, passphrase: string) => Promise<{ success: boolean; error?: string; code?: string; role?: string; handle?: string }>;
  activeConversationId: number | null;
  setActiveConversationId: (id: number | null) => void;
  connectWs: () => void;
}

const ApiContext = createContext<ApiContextValue | null>(null);

export const API_BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

export function ApiProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, userHandle, activeConversationId: openConversationId } = useApp();
  const [wsConnected, setWsConnected] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ApiContextValue['conversations']>([]);
  const [openChatMessages, setOpenChatMessages] = useState<ApiContextValue['openChatMessages']>([]);
  const [messages, setMessages] = useState<ApiContextValue['messages']>({});
  const [posts, setPosts] = useState<ApiContextValue['posts']>([]);
  const [captures, setCaptures] = useState<ApiContextValue['captures']>([]);
  const [replies, setReplies] = useState<ApiContextValue['replies']>({});
  const [smsMessages, setSmsMessages] = useState<ApiContextValue['smsMessages']>([]);
  const [searchResults, setSearchResults] = useState<ApiContextValue['searchResults']>([]);
  const [escrows, setEscrows] = useState<ApiContextValue['escrows']>([]);
  const [houseSettings, setHouseSettings] = useState<ApiContextValue['houseSettings']>({ holdingWallet: '', feeWallet: '', houseFeePercent: 3, chain: 'bitcoin', deposits: [], payments: [] });
  const [userProfiles, setUserProfiles] = useState<Record<string, UserProfile>>({});
  const [chatRooms, setChatRooms] = useState<ApiContextValue['chatRooms']>([]);
  const [roomMessages, setRoomMessages] = useState<ApiContextValue['roomMessages']>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connectWs = useCallback(() => {
    // Preview has no live socket. The local store updates on each request.
    setWsConnected(false);
    setWsError(null);
  }, []);

  useEffect(() => {
    connectWs();
    return () => { wsRef.current?.close(); };
  }, [connectWs]);

  const auth = useCallback(async (handle: string, passphrase: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle, passphrase })
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Login failed', code: data.code };
      return { success: true, role: data.role || 'basic', handle: data.handle };
    } catch {
      return { success: false, error: 'Network error' };
    }
  }, []);

  const register = useCallback(async (handle: string, passphrase: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle, passphrase })
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error || 'Registration failed', code: data.code };
      return { success: true, role: data.role || 'basic', handle: data.handle };
    } catch {
      return { success: false, error: 'Network error' };
    }
  }, []);

  const fetchConversations = useCallback(async (handle: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/conversations?handle=${encodeURIComponent(handle)}`);
      const data = await res.json();
      setConversations(Array.isArray(data) ? data : []);
    } catch { /* silently fail */ }
  }, []);

  const createConversation = useCallback(async (user1: string, user2: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user1, user2 }),
      });
      return await res.json();
    } catch { return null; }
  }, []);

  const seenChat = useRef("");
  const fetchOpenChat = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/open-chat`);
      const data = await res.json();
      const rows = Array.isArray(data) ? data : [];
      const last = rows[rows.length - 1];
      const marker = last ? String(last.id) : "";
      if (seenChat.current && marker && marker !== seenChat.current && last.sender_handle !== userHandle) cue("New message in the lounge");
      seenChat.current = marker;
      setOpenChatMessages(rows);
    } catch { /* silently fail */ }
  }, [userHandle]);

  const fetchMessages = useCallback(async (conversationId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/messages?handle=${encodeURIComponent(userHandle)}`);
      const data = await res.json();
      setMessages(prev => ({ ...prev, [conversationId]: Array.isArray(data) ? data : [] }));
    } catch { /* silently fail */ }
  }, [userHandle]);

  const sendPrivateMessage = useCallback(async (conversationId: number, sender: string, content: string, burnAfterRead = false, emojiEncrypted = false, e2eEncrypted = false, replyTo?: string | null, replyContent?: string | null, replySender?: string | null) => {
    try {
      await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender, content, burnAfterRead, emojiEncrypted, e2eEncrypted, replyTo, replyContent, replySender })
      });
    } catch { /* silently fail */ }
  }, []);

  const sendOpenChatMessage = useCallback(async (sender: string, content: string, emojiEncrypted = false, e2eEncrypted = false, replyTo?: number | null, replyContent?: string | null, replySender?: string | null) => {
    try {
      await fetch(`${API_BASE_URL}/api/open-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender, content, emojiEncrypted, e2eEncrypted, replyTo, replyContent, replySender })
      });
    } catch { /* silently fail */ }
  }, []);

  const burnMessage = useCallback(async (messageId: number) => {
    try {
      await fetch(`${API_BASE_URL}/api/messages/${messageId}/burn`, { method: 'POST' });
    } catch { /* silently fail */ }
  }, []);

  const searchUsers = useCallback(async (query: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : []);
      return data;
    } catch { setSearchResults([]); return []; }
  }, []);

  const fetchAllUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/users`);
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : []);
      return data;
    } catch { setSearchResults([]); return []; }
  }, []);

  const fetchUserProfile = useCallback(async (handle: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(handle)}/profile`);
      if (!res.ok) return null;
      const data = await res.json();
      const profile: UserProfile = { handle: data.handle, created_at: data.created_at, avatar: data.avatar || null };
      setUserProfiles(prev => {
        if (prev[handle]?.avatar === profile.avatar) return prev;
        return { ...prev, [handle]: profile };
      });
      return profile;
    } catch { return null; }
  }, []);

  const fetchSMS = useCallback(async (handle: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/sms?handle=${encodeURIComponent(handle)}`);
      const data = await res.json();
      setSmsMessages(Array.isArray(data) ? data : []);
    } catch { /* silently fail */ }
  }, []);

  const sendSMS = useCallback(async (sender: string, recipient: string, content: string, burnAfterRead = false) => {
    try {
      await fetch(`${API_BASE_URL}/api/sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender, recipient, content, burnAfterRead })
      });
    } catch { /* silently fail */ }
  }, []);

  const burnSMS = useCallback(async (messageId: number) => {
    try {
      await fetch(`${API_BASE_URL}/api/sms/${messageId}/burn`, { method: 'POST' });
    } catch { /* silently fail */ }
  }, []);

  const uploadFile = useCallback(async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE_URL}/api/upload`, { method: 'POST', body: formData });
      return await res.json();
    } catch { return null; }
  }, []);

  const fetchEscrows = useCallback(async (handle: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/escrow?handle=${encodeURIComponent(handle)}`);
      const data = await res.json();
      setEscrows(Array.isArray(data) ? data : []);
    } catch { setEscrows([]); }
  }, []);

  const createEscrow = useCallback(async (sender: string, recipient: string, amount: number, description: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/escrow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender, recipient, amount, description }),
      });
      return await res.json();
    } catch { return null; }
  }, []);

  const updateEscrow = useCallback(async (id: string, action: 'release' | 'dispute' | 'cancel') => {
    try {
      await fetch(`${API_BASE_URL}/api/escrow/${id}/${action}`, { method: 'POST' });
    } catch { /* silently fail */ }
  }, []);

  const resolveEscrow = useCallback(async (id: string, resolution: 'released' | 'refunded' | 'disputed', adminHandle: string, note?: string) => {
    try {
      await fetch(`${API_BASE_URL}/api/escrow/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution, adminHandle, note }),
      });
    } catch { /* silently fail */ }
  }, []);

  const fetchAllEscrows = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/escrow/all`);
      const data = await res.json();
      setEscrows(Array.isArray(data) ? data : []);
    } catch { setEscrows([]); }
  }, []);

  const fetchHouseSettings = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/house/settings`);
      const data = await res.json();
      setHouseSettings({
        holdingWallet: data.holdingWallet || '',
        feeWallet: data.feeWallet || '',
        houseFeePercent: 3,
        chain: 'bitcoin',
        houseAddress: data.houseAddress || data.feeWallet || '',
        payouts: Array.isArray(data.payouts) ? data.payouts : [],
        deposits: Array.isArray(data.deposits) ? data.deposits : [],
        payments: Array.isArray(data.payments) ? data.payments : [],
      });
    } catch { /* silently fail */ }
  }, []);

  const saveHouseSettings = useCallback(async (settings: { feeWallet?: string; chain?: string; payout?: string; actor?: string }) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/house/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) return data;
      setHouseSettings({
        holdingWallet: data.holdingWallet || settings.feeWallet || '',
        feeWallet: data.feeWallet || settings.feeWallet || '',
        houseFeePercent: 3,
        chain: 'bitcoin',
        houseAddress: data.houseAddress || data.feeWallet || '',
        payouts: Array.isArray(data.payouts) ? data.payouts : [],
        deposits: Array.isArray(data.deposits) ? data.deposits : [],
        payments: Array.isArray(data.payments) ? data.payments : [],
      });
      return data;
    } catch { return null; }
  }, []);

  const searchMessages = useCallback(async (handle: string, query: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/search/messages?handle=${encodeURIComponent(handle)}&q=${encodeURIComponent(query)}`);
      return await res.json();
    } catch { return []; }
  }, []);

  const fetchChatRooms = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat-rooms`);
      const data = await res.json();
      setChatRooms(Array.isArray(data) ? data : []);
    } catch { setChatRooms([]); }
  }, []);

  const createChatRoom = useCallback(async (name: string, creatorHandle: string, role = 'basic', isLocked = false, password: string | null = null) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat-rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, creatorHandle, role, isLocked, password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { error: err.error || `Error ${res.status}` };
      }
      const data = await res.json();
      setChatRooms(prev => [data, ...prev]);
      return data;
    } catch { return null; }
  }, []);

  const deleteChatRoom = useCallback(async (roomId: string) => {
    try {
      await fetch(`${API_BASE_URL}/api/chat-rooms/${roomId}`, { method: 'DELETE' });
      setChatRooms(prev => prev.filter(r => r.id !== roomId));
      if (activeRoomId === roomId) setActiveRoomId(null);
    } catch { /* silently fail */ }
  }, [activeRoomId]);

  const lockChatRoom = useCallback(async (roomId: string, lockedBy: string, reason?: string) => {
    try {
      await fetch(`${API_BASE_URL}/api/chat-rooms/${roomId}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lockedBy, reason }),
      });
      setChatRooms(prev => prev.map(r => r.id === roomId ? { ...r, is_locked: 1, locked_by: lockedBy, lock_reason: reason || '' } : r));
    } catch { /* silently fail */ }
  }, []);

  const unlockChatRoom = useCallback(async (roomId: string) => {
    try {
      await fetch(`${API_BASE_URL}/api/chat-rooms/${roomId}/unlock`, { method: 'POST' });
      setChatRooms(prev => prev.map(r => r.id === roomId ? { ...r, is_locked: 0, locked_by: null, lock_reason: null } : r));
    } catch { /* silently fail */ }
  }, []);

  const fetchRoomMessages = useCallback(async (roomId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat-rooms/${roomId}/messages`);
      const data = await res.json();
      setRoomMessages(Array.isArray(data) ? data : []);
    } catch { setRoomMessages([]); }
  }, []);

  const sendRoomMessage = useCallback(async (roomId: string, sender: string, content: string, emojiEncrypted = false, e2eEncrypted = false, replyTo?: number | null, replyContent?: string | null, replySender?: string | null) => {
    try {
      await fetch(`${API_BASE_URL}/api/chat-rooms/${roomId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender, content, emojiEncrypted, e2eEncrypted, replyTo, replyContent, replySender }),
      });
    } catch { /* silently fail */ }
  }, []);

  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/posts`);
      const data = await res.json();
      setPosts(Array.isArray(data) ? data : []);
    } catch { /* silently fail */ }
  }, []);

  const reportCapture = useCallback(async (handle: string, kind: "screenshot" | "recording") => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/captures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, kind, room: activeRoomId || "" }),
      });
      const data = await res.json();
      if (Array.isArray(data.captures)) setCaptures(data.captures);
      await fetchOpenChat();
      if (activeRoomId && activeRoomId !== "general") await fetchRoomMessages(activeRoomId);
    } catch { /* the notice can wait for the next refresh */ }
  }, [activeRoomId, fetchOpenChat, fetchRoomMessages]);

  const createPost = useCallback(async (author: string, authorHandle: string, content: string, emojiEncrypted = false, burnAfter = false, authorAvatar: string | null = null) => {
    try {
      await fetch(`${API_BASE_URL}/api/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author, authorHandle, content, emojiEncrypted, burnAfter, authorAvatar })
      });
    } catch { /* silently fail */ }
  }, []);

  const deletePost = useCallback(async (postId: string) => {
    try {
      await fetch(`${API_BASE_URL}/api/posts/${postId}`, { method: 'DELETE' });
    } catch { /* silently fail */ }
  }, []);

  const likePost = useCallback(async (postId: string, userHandle: string) => {
    try {
      await fetch(`${API_BASE_URL}/api/posts/${postId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userHandle })
      });
    } catch { /* silently fail */ }
  }, []);

  const dislikePost = useCallback(async (postId: string, userHandle: string) => {
    try {
      await fetch(`${API_BASE_URL}/api/posts/${postId}/dislike`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userHandle })
      });
    } catch { /* silently fail */ }
  }, []);

  const sharePost = useCallback(async (postId: string) => {
    try {
      await fetch(`${API_BASE_URL}/api/posts/${postId}/share`, { method: 'POST' });
    } catch { /* silently fail */ }
  }, []);

  const fetchReplies = useCallback(async (postId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/posts/${postId}/replies`);
      const data = await res.json();
      setReplies(prev => ({ ...prev, [postId]: Array.isArray(data) ? data : [] }));
    } catch { /* silently fail */ }
  }, []);

  const createReply = useCallback(async (postId: string, author: string, content: string) => {
    try {
      await fetch(`${API_BASE_URL}/api/posts/${postId}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author, content })
      });
    } catch { /* silently fail */ }
  }, []);

  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const liveRoomRef = useRef(activeRoomId);
  const liveConvRef = useRef(openConversationId);
  liveRoomRef.current = activeRoomId;
  liveConvRef.current = openConversationId;
  const refreshingRef = useRef(false);
  const pendingRef = useRef(false);

  const refreshLive = useCallback(async () => {
    if (!isAuthenticated || !userHandle) return;
    if (refreshingRef.current) {
      pendingRef.current = true;
      return;
    }
    refreshingRef.current = true;
    try {
      await Promise.all([
        fetchOpenChat(),
        fetchChatRooms(),
        fetchPosts(),
        fetch(`${API_BASE_URL}/api/captures`).then((res) => res.json()).then((data) => { if (Array.isArray(data)) setCaptures(data); }).catch(() => {}),
        fetchConversations(userHandle),
        fetchSMS(userHandle),
      ]);
      const room = liveRoomRef.current;
      if (room && room !== "general") await fetchRoomMessages(room);
      const conv = liveConvRef.current;
      if (conv) await fetchMessages(Number(conv));
    } finally {
      refreshingRef.current = false;
      if (pendingRef.current) {
        pendingRef.current = false;
        void refreshLive();
      }
    }
  }, [isAuthenticated, userHandle, fetchOpenChat, fetchChatRooms, fetchPosts, fetchConversations, fetchSMS, fetchRoomMessages, fetchMessages]);

  useEffect(() => {
    if (!isAuthenticated || !userHandle) return;
    void refreshLive();
    const tick = window.setInterval(() => { void refreshLive(); }, 2000);
    const onLive = () => { void refreshLive(); };
    const onVisible = () => { if (document.visibilityState === "visible") void refreshLive(); };
    window.addEventListener("omerta-live", onLive);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(tick);
      window.removeEventListener("omerta-live", onLive);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isAuthenticated, userHandle, refreshLive]);

  return (
    <ApiContext.Provider value={{
      wsConnected,
      wsError,
      conversations,
      openChatMessages,
      messages,
      posts,
      replies,
      smsMessages,
      searchResults,
      escrows,
      fetchConversations,
      createConversation,
      fetchOpenChat,
      fetchMessages,
      sendPrivateMessage,
      sendOpenChatMessage,
      burnMessage,
      searchUsers,
      fetchAllUsers,
      fetchSMS,
      sendSMS,
      burnSMS,
      uploadFile,
      fetchEscrows,
      createEscrow,
      updateEscrow,
      resolveEscrow,
      fetchAllEscrows,
      houseSettings,
      fetchHouseSettings,
      saveHouseSettings,
      searchMessages,
      chatRooms,
      roomMessages,
      activeRoomId,
      setActiveRoomId,
      fetchChatRooms,
      createChatRoom,
      deleteChatRoom,
      lockChatRoom,
      unlockChatRoom,
      fetchRoomMessages,
      sendRoomMessage,
      fetchPosts,
      captures,
      reportCapture,
      createPost,
      deletePost,
      likePost,
      dislikePost,
      sharePost,
      fetchReplies,
      createReply,
      userProfiles,
      fetchUserProfile,
      auth,
      register,
      activeConversationId,
      setActiveConversationId,
      connectWs,
    }}>
      {children}
    </ApiContext.Provider>
  );
}

export function useApi() {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error('useApi must be used within ApiProvider');
  return ctx;
}