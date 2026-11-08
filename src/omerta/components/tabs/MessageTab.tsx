import { useState, useCallback, useEffect } from 'react';
import { useApp } from '@omerta/store/AppContext';
import { useApi } from '@omerta/store/ApiContext';
import ChatSidebar from '@omerta/components/ChatSidebar';
import ChatWindow from '@omerta/components/ChatWindow';
import { Search, X } from 'lucide-react';

export default function MessageTab() {
  const { activeConversationId, userHandle } = useApp();
  const { searchMessages } = useApi();
  const [, setMobileShowChat] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<Record<string, unknown>>>([]);
  const [searching, setSearching] = useState(false);
  const [phone, setPhone] = useState("");

  const hasActiveChat = !!activeConversationId;

  const doSearch = useCallback(async () => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const results = await searchMessages(userHandle, searchQuery.trim());
    setSearchResults(Array.isArray(results) ? results : []);
    setSearching(false);
  }, [searchQuery, userHandle, searchMessages]);

  useEffect(() => {
    const timer = setTimeout(() => { doSearch(); }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, doSearch]);

  return (
    <div className="flex h-full min-w-0" style={{ background: 'hsl(var(--background))' }}>
      {/* Sidebar */}
      <div
        className={hasActiveChat
          ? 'hidden md:block md:w-[260px] lg:w-[300px] md:flex-shrink-0 h-full border-r flex flex-col'
          : 'block w-full md:w-[260px] lg:w-[300px] md:flex-shrink-0 h-full border-r flex flex-col'
        }
        style={{ background: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}
      >
        {/* Search bar */}
        <div className="p-3 border-b border-noir-800">
          <div
            className="flex items-center gap-2 p-2 rounded-md cursor-pointer transition-all hover:brightness-110"
            style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
            onClick={() => setShowSearch(!showSearch)}
          >
            <Search size={12} style={{ color: 'hsl(var(--muted-foreground))' }} />
            <span className="font-mono text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Search messages...</span>
          </div>
          <form className="flex gap-2 mt-2" onSubmit={(e) => {
            e.preventDefault();
            const number = phone.replace(/[^\d+]/g, "");
            if (number.length < 7) return;
            window.location.href = "sms:" + number;
          }}>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="Phone number" className="flex-1 rounded-sm px-2 py-1.5 font-mono text-[10px]" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }} />
            <button type="submit" className="px-2 rounded-sm font-mono text-[10px] uppercase" style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}>Text</button>
          </form>
        </div>

        {/* Search overlay */}
        {showSearch && (
          <div className="absolute inset-0 z-50 bg-black/60 flex items-start justify-center pt-20 px-4">
            <div className="w-full max-w-md rounded-lg border shadow-2xl overflow-hidden" style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}>
              <div className="flex items-center gap-2 p-3 border-b" style={{ borderColor: 'hsl(var(--border))' }}>
                <Search size={14} style={{ color: 'hsl(var(--muted-foreground))' }} />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search all messages..."
                  className="flex-1 bg-transparent font-mono text-sm focus:outline-none"
                  style={{ color: 'hsl(var(--foreground))' }}
                />
                <button onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }}>
                  <X size={14} style={{ color: 'hsl(var(--muted-foreground))' }} />
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto">
                {searching && (
                  <div className="p-4 font-mono text-xs text-center animate-pulse" style={{ color: 'hsl(var(--muted-foreground))' }}>Searching...</div>
                )}

                {!searching && searchResults.length === 0 && searchQuery.length >= 2 && (
                  <div className="p-4 font-mono text-xs text-center" style={{ color: 'hsl(var(--muted-foreground))' }}>No results</div>
                )}

                {searchResults.map((msg: any, idx) => (
                  <div key={idx} className="p-3 border-b hover:brightness-110 cursor-pointer transition-all" style={{ borderColor: 'hsl(var(--border) / 0.5)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[10px] uppercase" style={{ color: 'hsl(var(--primary))' }}>
                        {msg.is_sms ? 'SMS' : msg.other_handle || 'Chat'}
                      </span>
                      <span className="font-mono text-[9px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
                        {msg.timestamp ? new Date(msg.timestamp).toLocaleDateString() : ''}
                      </span>
                    </div>
                    <p className="font-mono text-xs truncate" style={{ color: 'hsl(var(--foreground))' }}>
                      {typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="p-2 border-t text-center" style={{ borderColor: 'hsl(var(--border))' }}>
                <span className="font-mono text-[9px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  {searchResults.length} RESULT{searchResults.length !== 1 ? 'S' : ''}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          <ChatSidebar onSelect={() => setMobileShowChat(true)} />
        </div>
      </div>

      {/* Chat */}
      <div
        className={hasActiveChat
          ? 'block w-full md:flex-1 md:w-auto h-full bg-noir-950 min-w-0'
          : 'hidden md:block md:flex-1 md:w-auto h-full bg-noir-950 min-w-0'
        }
      >
        <ChatWindow onBack={() => setMobileShowChat(false)} />
      </div>
    </div>
  );
}
