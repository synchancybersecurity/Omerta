import { useState, useEffect, useRef } from 'react';
import { Search, ShieldCheck, MessageSquare, X, Users, Phone, Plus, UserCircle, Trash2 } from 'lucide-react';
import { useApp } from '@omerta/store/AppContext';
import { useApi } from '@omerta/store/ApiContext';
import UserProfileModal from '@omerta/components/UserProfileModal';

interface Toast { id: number; text: string; type: 'success' | 'error'; }

export default function ContactsTab() {
  const { userHandle, setActiveConversation, setActiveTab, setViewingProfile } = useApp();
  const { searchUsers, fetchConversations, createConversation, fetchUserProfile, userProfiles } = useApi();
  const [query, setQuery] = useState('');
  const [myContacts, setMyContacts] = useState<string[]>([]);
  const [discoverResults, setDiscoverResults] = useState<{id: number; handle: string; created_at: number}[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [loading, setLoading] = useState(false);
  const [profileUser, setProfileUser] = useState<{ handle: string; avatar?: string | null; createdAt?: number } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    const t = { id: Date.now(), text, type };
    setToasts(prev => [...prev, t]);
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), 2000);
  };

  // Load my contacts from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('omerta_contacts_v2');
    if (saved) {
      try { setMyContacts(JSON.parse(saved)); } catch { setMyContacts([]); }
    }
  }, []);

  // Fetch profiles for all contacts and discover results
  useEffect(() => {
    const handles = [...myContacts];
    discoverResults.forEach(u => { if (!handles.includes(u.handle)) handles.push(u.handle); });
    handles.forEach(h => {
      if (h && !userProfiles[h]) fetchUserProfile(h);
    });
  }, [myContacts, discoverResults, fetchUserProfile, userProfiles]);

  // Live search as user types
  useEffect(() => {
    if (query.length < 1) {
      setDiscoverResults([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      searchUsers(query).then(results => {
        setDiscoverResults(results);
        setLoading(false);
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [query, searchUsers]);

  const addContact = (handle: string) => {
    setMyContacts(prev => {
      const trimmed = handle.trim();
      if (!trimmed || prev.includes(trimmed)) {
        showToast(`// ALREADY IN CONTACTS: ${trimmed} //`, 'error');
        return prev;
      }
      const updated = [...prev, trimmed];
      localStorage.setItem('omerta_contacts_v2', JSON.stringify(updated));
      showToast(`// ADDED: ${trimmed} //`);
      return updated;
    });
  };

  const removeContact = (handle: string) => {
    setMyContacts(prev => {
      const updated = prev.filter(h => h !== handle);
      localStorage.setItem('omerta_contacts_v2', JSON.stringify(updated));
      showToast(`// REMOVED: ${handle} //`, 'error');
      return updated;
    });
  };

  const startMessage = async (handle: string) => {
    if (handle === userHandle) { showToast('// CANNOT MESSAGE YOURSELF //', 'error'); return; }
    showToast(`// OPENING: ${handle} //`);
    try {
      const conv = await createConversation(userHandle, handle);
      if (conv && conv.id) {
        await fetchConversations(userHandle);
        setActiveConversation(String(conv.id));
      } else {
        await fetchConversations(userHandle);
      }
      setActiveTab('message');
    } catch { showToast('// FAILED TO OPEN CHAT //', 'error'); }
  };

  const handleViewProfile = (handle: string) => {
    const profile = userProfiles[handle];
    setProfileUser({ handle, avatar: profile?.avatar, createdAt: profile?.created_at });
  };

  return (
    <div className="h-full flex flex-col p-3 md:p-6 overflow-y-auto overflow-x-hidden scrollbar-thin bg-noir-950">
      {/* Header */}
      <div className="mb-4">
        <h2 className="font-serif text-3xl text-white tracking-wider mb-1">CONTACTS</h2>
        <p className="font-mono text-xs text-noir-500 tracking-wider">// YOUR NETWORK //</p>
      </div>

      {/* Search — Discover All Users */}
      <div className="mb-4 max-w-2xl">
        <div className="flex items-center gap-2 p-2 border border-noir-700 rounded-md bg-noir-900">
          <Search size={14} className="text-noir-500 flex-shrink-0" />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search all users..."
            className="flex-1 bg-transparent font-mono text-xs text-white focus:outline-none placeholder:text-noir-500"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-noir-500 hover:text-white">
              <X size={12} />
            </button>
          )}
        </div>
        <p className="font-mono text-[10px] text-noir-600 mt-1">// ALL REGISTERED USERS ARE SEARCHABLE //</p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="mb-3 font-mono text-[10px] text-noir-500 tracking-wider animate-pulse max-w-2xl">// SEARCHING SERVER... //</div>
      )}

      {/* DISCOVER — Search Results */}
      {query.length > 0 && (
        <div className="mb-6 max-w-2xl">
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-noir-500 mb-2">// DISCOVER //</h3>
          {discoverResults.length === 0 && !loading && (
            <div className="p-6 border border-noir-800 rounded-lg bg-noir-900 text-center">
              <Search size={20} className="text-noir-700 mx-auto mb-2" />
              <p className="font-mono text-xs text-noir-500">No users found matching &quot;{query}&quot;</p>
            </div>
          )}
          <div className="space-y-2">
            {discoverResults.map((user) => {
              const isAdded = myContacts.includes(user.handle);
              return (
                <div key={user.id} className="flex items-center gap-3 p-3 border border-noir-800 rounded-lg bg-noir-900 hover:border-noir-700 transition-all">
                  {/* Avatar */}
                  <button
                    onClick={() => handleViewProfile(user.handle)}
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-serif text-sm font-bold text-white self-start hover:scale-110 transition-transform overflow-hidden"
                    style={{ background: 'hsl(var(--primary))' }}
                  >
                    {userProfiles[user.handle]?.avatar ? (
                      <img src={userProfiles[user.handle].avatar!} alt="" className="w-full h-full object-cover" />
                    ) : (
                      user.handle.charAt(0).toUpperCase()
                    )}
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-mono text-sm text-white truncate">{user.handle}</h3>
                    <span className="font-mono text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
                      @{user.handle.toLowerCase()} | {new Date(user.created_at * 1000).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => startMessage(user.handle)}
                      className="p-1.5 rounded-sm transition-colors hover:brightness-125"
                      style={{ color: 'hsl(var(--primary))' }}
                      title="Message"
                    >
                      <MessageSquare size={14} />
                    </button>
                    <button
                      onClick={() => isAdded ? undefined : addContact(user.handle)}
                      disabled={isAdded}
                      className="p-1.5 rounded-sm transition-colors hover:brightness-125 disabled:opacity-40"
                      style={{ color: isAdded ? 'hsl(142, 76%, 36%)' : 'hsl(var(--primary))' }}
                      title={isAdded ? 'Already Added' : 'Add Contact'}
                    >
                      {isAdded ? <ShieldCheck size={14} /> : <Plus size={14} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MY CONTACTS */}
      <div className="max-w-2xl flex-1">
        <h3 className="font-mono text-[10px] uppercase tracking-wider text-noir-500 mb-2">// MY CONTACTS ({myContacts.length}) //</h3>

        {myContacts.length === 0 && (
          <div className="p-6 border border-noir-800 rounded-lg bg-noir-900 text-center">
            <Users size={20} className="text-noir-700 mx-auto mb-2" />
            <p className="font-mono text-xs text-noir-500 mb-1">No contacts yet</p>
            <p className="font-mono text-[10px] text-noir-600">Search above to discover and add users</p>
          </div>
        )}

        <div className="space-y-2">
          {myContacts.map((handle) => {
            const profile = userProfiles[handle];
            return (
              <div key={handle} className="flex items-center gap-3 p-3 border border-noir-800 rounded-lg bg-noir-900 hover:border-noir-700 transition-all">
                {/* Avatar */}
                <button
                  onClick={() => handleViewProfile(handle)}
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-serif text-sm font-bold text-white self-start hover:scale-110 transition-transform overflow-hidden"
                  style={{ background: 'hsl(var(--primary))' }}
                >
                  {profile?.avatar ? (
                    <img src={profile.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    handle.charAt(0).toUpperCase()
                  )}
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-mono text-sm text-white truncate">{handle}</h3>
                  <span className="font-mono text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
                    @{handle.toLowerCase()}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => startMessage(handle)}
                    className="p-1.5 rounded-sm transition-colors hover:brightness-125"
                    style={{ color: 'hsl(var(--primary))' }}
                    title="Message"
                  >
                    <MessageSquare size={14} />
                  </button>
                  <button
                    onClick={() => handleViewProfile(handle)}
                    className="p-1.5 rounded-sm transition-colors hover:brightness-125"
                    style={{ color: 'hsl(var(--muted-foreground))' }}
                    title="View Profile"
                  >
                    <UserCircle size={14} />
                  </button>
                  <button
                    onClick={() => removeContact(handle)}
                    className="p-1.5 rounded-sm transition-colors hover:brightness-125"
                    style={{ color: 'hsl(var(--muted-foreground))' }}
                    title="Remove"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-4 p-3 border border-noir-800 rounded-md bg-noir-900">
          <div className="flex items-center gap-2">
            <Phone size={10} style={{ color: 'hsl(var(--primary))' }} />
            <span className="font-mono text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
              {myContacts.length} CONTACT{myContacts.length !== 1 ? 'S' : ''} | YOUR HANDLE: @{userHandle}
            </span>
          </div>
        </div>
      </div>

      {/* Toasts */}
      {toasts.map(t => (
        <div key={t.id} className={`fixed bottom-6 right-6 px-4 py-2 font-mono text-xs border rounded-sm z-50 ${t.type === 'success' ? 'border-blood/30 bg-noir-900 text-blood' : 'border-noir-700 bg-noir-900 text-noir-400'}`}>
          {t.text}
        </div>
      ))}

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={!!profileUser}
        onClose={() => setProfileUser(null)}
        user={{ handle: profileUser?.handle || '', avatar: profileUser?.avatar, createdAt: profileUser?.createdAt }}
        onMessage={(h) => { startMessage(h); setProfileUser(null); }}
        onAddContact={(h) => { addContact(h); setProfileUser(null); }}
        onViewProfile={(h) => { setViewingProfile(h); setActiveTab('profile'); setProfileUser(null); }}
      />
    </div>
  );
}
