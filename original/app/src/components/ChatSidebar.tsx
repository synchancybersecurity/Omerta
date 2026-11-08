import { useApp } from '@/store/AppContext';
import { useApi } from '@/store/ApiContext';
import { Search, Plus, Lock, X, Send } from 'lucide-react';
import { useState, useEffect } from 'react';
import UserProfileModal from '@/components/UserProfileModal';

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getInitials(handle: string) {
  return handle.slice(0, 2).toUpperCase();
}

const SUGGESTED_HANDLES = ['SILENCER_9', 'GHOST_MAKER', 'THE_CONSIGLIERE', 'NIGHT_OWL', 'ZERO_TRACE', 'IRON_FIST'];

function deriveAvatarColor(handle: string) {
  const hue = Array.from(handle).reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return `hsl(${hue}, 70%, 40%)`;
}

export default function ChatSidebar({ onSelect }: { onSelect?: () => void }) {
  const { activeConversationId, setActiveConversation, userHandle, setActiveTab, setViewingProfile } = useApp();
  const { fetchConversations, conversations, userProfiles, fetchUserProfile, createConversation } = useApi();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCompose, setShowCompose] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeMsg, setComposeMsg] = useState('');
  const [profileUser, setProfileUser] = useState<{ handle: string; avatar?: string | null; createdAt?: number } | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 2000); };

  const addContact = (handle: string) => {
    const existing = JSON.parse(localStorage.getItem('omerta_contacts_v2') || '[]');
    if (!existing.includes(handle)) {
      localStorage.setItem('omerta_contacts_v2', JSON.stringify([...existing, handle]));
      showToast(`// ADDED: ${handle} //`);
    } else {
      showToast(`// ALREADY ADDED: ${handle} //`);
    }
  };

  const startMessage = async (handle: string) => {
    if (handle === userHandle) { showToast('// CANNOT MESSAGE YOURSELF //'); return; }
    try {
      const conv = await createConversation(userHandle, handle);
      if (conv && conv.id) {
        await fetchConversations(userHandle);
        setActiveConversation(String(conv.id));
      } else {
        await fetchConversations(userHandle);
      }
      setActiveTab('message');
      showToast(`// OPENING: ${handle} //`);
    } catch { showToast('// FAILED //'); }
  };

  const viewProfile = (handle: string) => {
    setViewingProfile(handle);
    setActiveTab('profile');
    showToast(`// VIEWING: ${handle} //`);
  };

  // Load conversations from server on mount
  useEffect(() => {
    if (userHandle) fetchConversations(userHandle);
  }, [userHandle, fetchConversations]);

  // Transform API conversations to display format
  const displayConversations = conversations.map(conv => {
    const partnerHandle = conv.user1_handle === userHandle ? conv.user2_handle : conv.user1_handle;
    return {
      id: String(conv.id),
      handle: partnerHandle,
      avatarColor: deriveAvatarColor(partnerHandle),
      lastMessage: conv.last_message || '',
      timestamp: conv.last_timestamp || Date.now(),
      unread: conv.unread || 0,
      encrypted: false,
    };
  });

  // Fetch profiles for all conversation partners
  useEffect(() => {
    displayConversations.forEach(conv => {
      if (conv.handle && !userProfiles[conv.handle]) {
        fetchUserProfile(conv.handle);
      }
    });
  }, [displayConversations, fetchUserProfile, userProfiles]);

  const filtered = displayConversations.filter(c =>
    c.handle.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (id: string | number) => {
    setActiveConversation(String(id));
    onSelect?.();
  };

  const handleSendNew = () => {
    if (!composeTo.trim() || !composeMsg.trim()) return;
    setShowCompose(false);
    setComposeTo('');
    setComposeMsg('');
    // In a real app this would create a new conversation
    // For now, just open the first existing conversation
    if (conversations.length > 0) {
      handleSelect(conversations[0].id);
    }
  };

  return (
    <div className="h-full flex flex-col bg-noir-950 min-w-0 relative">
      {/* Compose Modal Overlay */}
      {showCompose && (
        <div className="absolute inset-0 z-30 bg-noir-950 flex flex-col p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-mono text-sm text-white uppercase tracking-wider">New Message</h3>
            <button onClick={() => setShowCompose(false)} className="p-1 text-noir-400 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block font-mono text-[10px] text-noir-400 uppercase tracking-wider mb-1">TO:</label>
              <input
                type="text" value={composeTo} onChange={(e) => setComposeTo(e.target.value)}
                placeholder="Enter handle..."
                className="w-full bg-noir-900 border border-noir-700 rounded-md px-3 py-2 font-mono text-xs text-white focus:outline-none focus:border-blood/40 placeholder:text-noir-500 transition-colors"
              />
            </div>
            {composeTo.length < 2 && (
              <div>
                <p className="font-mono text-[10px] text-noir-500 uppercase tracking-wider mb-2">Suggested</p>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTED_HANDLES.map(h => (
                    <button key={h} onClick={() => setComposeTo(h)} className="px-2 py-1 bg-noir-900 border border-noir-700 rounded-md text-noir-300 font-mono text-[10px] uppercase hover:border-blood/30 hover:text-white transition-colors">
                      {h}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="block font-mono text-[10px] text-noir-400 uppercase tracking-wider mb-1">MESSAGE:</label>
              <textarea
                value={composeMsg} onChange={(e) => setComposeMsg(e.target.value)}
                placeholder="Type your message..."
                rows={3}
                className="w-full bg-noir-900 border border-noir-700 rounded-md px-3 py-2 font-mono text-xs text-white focus:outline-none focus:border-blood/40 placeholder:text-noir-500 resize-none transition-colors"
              />
            </div>
            <button
              onClick={handleSendNew}
              disabled={!composeTo.trim() || !composeMsg.trim()}
              className="w-full py-2 bg-blood text-white font-mono text-xs uppercase tracking-wider rounded-md hover:brightness-110 disabled:opacity-30 transition-all flex items-center justify-center gap-2"
            >
              <Send size={14} /> Send Message
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center px-3 py-3 border-b border-noir-800">
        <h2 className="font-serif text-base text-white tracking-wider truncate">Chats</h2>
      </div>

      {/* Search + New */}
      <div className="px-3 py-2.5 space-y-2">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-noir-500" />
          <input
            type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Find contact..."
            className="w-full bg-noir-900 border border-noir-700 rounded-md pl-8 pr-2 py-2 font-mono text-xs text-white focus:outline-none focus:border-blood/40 placeholder:text-noir-600 transition-colors"
          />
        </div>
        <button onClick={() => setShowCompose(true)} className="w-full flex items-center justify-center gap-1.5 py-2 border border-noir-700 text-noir-300 font-mono text-[11px] uppercase tracking-wider hover:bg-blood/10 hover:border-blood/30 hover:text-white transition-colors rounded-md">
          <Plus size={14} /> New Message
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-1.5 pb-3">
        {filtered.map((conv) => {
          const isActive = conv.id === activeConversationId;
          return (
            <button
              key={conv.id} onClick={() => handleSelect(conv.id)}
              className={`w-full text-left px-2.5 py-3 rounded-md mb-0.5 transition-all duration-200 ${isActive ? 'bg-blood/15 border-l-[3px] border-blood' : 'hover:bg-noir-900 border-l-[3px] border-transparent hover:border-noir-700'}`}
            >
              <div className="flex items-center gap-2.5">
                <button
                  onClick={(e) => { e.stopPropagation(); setProfileUser({ handle: conv.handle, avatar: userProfiles[conv.handle]?.avatar, createdAt: undefined }); }}
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-serif text-xs font-bold text-white hover:scale-110 transition-transform overflow-hidden"
                  style={{ backgroundColor: conv.avatarColor }}
                >
                  {userProfiles[conv.handle]?.avatar ? (
                    <img src={userProfiles[conv.handle].avatar!} alt="" className="w-full h-full object-cover" />
                  ) : (
                    getInitials(conv.handle)
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`font-mono text-[12px] uppercase tracking-wider truncate ${isActive ? 'text-white' : 'text-noir-200'}`}>{conv.handle}</span>
                    <span className="font-mono text-[9px] text-noir-500 flex-shrink-0 whitespace-nowrap">{formatTime(conv.timestamp)}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {conv.encrypted && <Lock size={8} className="text-blood/50 flex-shrink-0" />}
                    <span className="font-mono text-[10px] text-noir-400 truncate">{conv.lastMessage}</span>
                  </div>
                </div>
                {conv.unread > 0 && <div className="w-2 h-2 rounded-full bg-blood flex-shrink-0 animate-pulse-red" />}
              </div>
            </button>
          );
        })}
      </div>
      {/* Toast */}
      {toastMsg && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-noir-900 border border-noir-700 rounded-md font-mono text-xs text-white z-50">{toastMsg}</div>
      )}

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={!!profileUser}
        onClose={() => setProfileUser(null)}
        user={{ handle: profileUser?.handle || '', avatar: profileUser?.avatar, createdAt: profileUser?.createdAt }}
        onMessage={(h) => { startMessage(h); setProfileUser(null); }}
        onAddContact={(h) => { addContact(h); setProfileUser(null); }}
        onViewProfile={(h) => { viewProfile(h); setProfileUser(null); }}
      />
    </div>
  );
}
