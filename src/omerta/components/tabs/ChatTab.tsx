import { useState, useEffect, useRef } from 'react';
import { useApp } from '@omerta/store/AppContext';
import { useApi } from '@omerta/store/ApiContext';
import { emojiEncrypt, emojiDecrypt } from '@omerta/utils/emojiCipher';
import { Hash, Lock, Send, X, Reply, ChevronLeft, Plus, Trash2, Globe, Users, Paperclip } from 'lucide-react';
import { AttachmentView, attachmentLabel, packAttachment } from '@omerta/components/Attachment';
import { useLongPress } from '@omerta/hooks/useLongPress';
import UserProfileModal from '@omerta/components/UserProfileModal';

function RoomBubble({ msg, isMe, currentUserHandle, onReply, onViewUser }: {
  msg: { id: number; sender_handle: string; content: string; timestamp: number; emoji_encrypted: number; reply_to?: number | null; reply_content?: string | null; reply_sender?: string | null };
  isMe: boolean;
  currentUserHandle: string;
  onReply: (id: number, content: string, sender: string) => void;
  onViewUser?: (handle: string) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const [decrypted, setDecrypted] = useState(false);
  const { userProfiles } = useApi();

  const senderAvatar = userProfiles[msg.sender_handle]?.avatar || null;
  const isEncrypted = msg.emoji_encrypted === 1;

  const { handlers } = useLongPress({
    onLongPress: () => { if (isEncrypted) setDecrypted(true); },
    onRelease: () => setDecrypted(false),
    ms: 600,
  });

  const displayContent = isEncrypted
    ? (decrypted ? emojiDecrypt(msg.content) || msg.content : msg.content)
    : msg.content;

  return (
    <div className={`flex items-start gap-2 mb-2 ${isMe ? 'flex-row-reverse' : ''}`}>
      <button
        onClick={() => onViewUser?.(msg.sender_handle)}
        className="w-8 h-8 rounded-full flex-shrink-0 self-start hover:scale-110 transition-transform overflow-hidden border"
        style={{ borderColor: 'hsl(var(--primary) / 0.4)' }}
      >
        {senderAvatar ? (
          <img src={senderAvatar} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center font-serif text-[10px] font-bold text-white" style={{ background: `hsl(${Array.from(msg.sender_handle).reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360}, 70%, 40%)` }}>
            {msg.sender_handle.slice(0, 2)}
          </div>
        )}
      </button>

      <div className="max-w-[75%]">
        {/* Reply indicator */}
        {msg.reply_to && msg.reply_content && (
          <div className={`mb-1 px-3 py-1.5 rounded-lg ${isMe ? 'ml-auto' : 'mr-auto'}`} style={{ background: 'hsl(var(--reply-quote-bg))', border: '1px solid hsl(var(--reply-quote-border))' }}>
            <div className="flex items-center gap-1.5 mb-0.5">
              <Reply size={10} style={{ color: 'hsl(var(--primary) / 0.6)' }} />
              <span className="font-mono text-[9px] uppercase tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>
                Replying to {msg.reply_sender === currentUserHandle ? 'You' : (msg.reply_sender || 'unknown')}
              </span>
            </div>
            <p className="font-mono text-[11px] truncate" style={{ color: 'hsl(var(--bubble-meta))' }}>{attachmentLabel(msg.reply_content)}</p>
          </div>
        )}

        {/* Bubble */}
        <div
          {...handlers}
          onClick={() => setShowActions(!showActions)}
          className="relative px-3.5 py-2.5 rounded-2xl shadow-message select-none cursor-pointer"
          style={{
            background: isMe ? 'hsl(var(--bubble-sent-bg))' : 'hsl(var(--bubble-recv-bg))',
            border: isMe ? 'var(--bubble-sent-outline) solid hsl(var(--bubble-sent-border))' : 'var(--bubble-recv-outline) solid hsl(var(--bubble-recv-border))',
            borderRadius: isMe ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem',
          }}
        >
          {isEncrypted && <div className="flex items-center gap-1 mb-1 opacity-60"><Lock size={9} style={{ color: 'hsl(var(--primary))' }} /><span className="font-mono text-[8px] tracking-wider" style={{ color: 'hsl(var(--primary))' }}>ENCRYPTED{decrypted ? ' · HOLD TO HIDE' : ' · HOLD TO REVEAL'}</span></div>}
          <div className="flex items-center gap-2 mb-1">
            <span className="font-serif text-xs tracking-wider" style={{ color: isMe ? 'hsl(var(--accent-sent))' : 'hsl(var(--accent-recv))' }}>{msg.sender_handle}</span>
          </div>
          {isEncrypted && !decrypted ? (
            <p className="font-mono text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: isMe ? 'hsl(var(--sent-text))' : 'hsl(var(--recv-text))' }}>{displayContent}</p>
          ) : (
            <div style={{ color: isMe ? 'hsl(var(--sent-text))' : 'hsl(var(--recv-text))' }}><AttachmentView content={displayContent} /></div>
          )}
          <span className="font-mono text-[9px] mt-1 block opacity-50" style={{ color: isMe ? 'hsl(var(--sent-meta))' : 'hsl(var(--recv-meta))' }}>
            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Actions */}
        {showActions && (
          <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`} style={{ borderTop: '1px solid hsl(var(--action-bar-border))', paddingTop: '4px' }}>
            <button onClick={(e) => { e.stopPropagation(); onReply(msg.id, msg.content, msg.sender_handle); setShowActions(false); }} className="p-1" style={{ color: 'hsl(var(--muted-foreground))' }} title="Reply"><Reply size={12} /></button>
            <button onClick={(e) => { e.stopPropagation(); setShowActions(false); }} className="p-1" style={{ color: 'hsl(var(--muted-foreground))' }}><X size={12} /></button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatTab() {
  const { userHandle, setActiveTab, setActiveConversation, userRole, setViewingProfile } = useApp();
  const {
    openChatMessages, fetchOpenChat, sendOpenChatMessage,
    chatRooms, fetchChatRooms, createChatRoom, deleteChatRoom, lockChatRoom, unlockChatRoom,
    roomMessages, fetchRoomMessages, sendRoomMessage,
    activeRoomId, setActiveRoomId, userProfiles, fetchUserProfile,
    createConversation, fetchConversations, uploadFile,
  } = useApi();

  const [input, setInput] = useState('');
  const [emojiMode, setEmojiMode] = useState(false);
  const [toast, setToast] = useState('');
  const [profileUser, setProfileUser] = useState<{ handle: string } | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ id: number; content: string; sender: string } | null>(null);
  const [showRoomList, setShowRoomList] = useState(true);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomLocked, setRoomLocked] = useState(false);
  const [roomPassword, setRoomPassword] = useState('');
  const [enterPassword, setEnterPassword] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [passwordRoom, setPasswordRoom] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch rooms and profiles
  useEffect(() => { fetchChatRooms(); fetchOpenChat(); }, [fetchChatRooms, fetchOpenChat]);

  useEffect(() => {
    const tick = () => {
      fetchOpenChat();
      fetchChatRooms();
      if (activeRoomId && activeRoomId !== "general") fetchRoomMessages(activeRoomId);
    };
    const id = window.setInterval(tick, 30000);
    return () => window.clearInterval(id);
  }, [activeRoomId, fetchChatRooms, fetchOpenChat, fetchRoomMessages]);

  // Fetch messages for active room
  useEffect(() => {
    if (activeRoomId === 'general') {
      fetchOpenChat();
    } else if (activeRoomId) {
      fetchRoomMessages(activeRoomId);
    }
  }, [activeRoomId, fetchOpenChat, fetchRoomMessages]);

  // Fetch profiles for all message senders
  const fetchingRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const msgs = activeRoomId === 'general' ? openChatMessages : roomMessages;
    const senders = [...new Set(msgs.map(m => m.sender_handle))];
    senders.forEach(h => {
      if (h && !userProfiles[h] && !fetchingRef.current.has(h)) {
        fetchingRef.current.add(h);
        fetchUserProfile(h).finally(() => fetchingRef.current.delete(h));
      }
    });
  }, [activeRoomId === 'general' ? openChatMessages.length : roomMessages.length, fetchUserProfile, activeRoomId]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [activeRoomId === 'general' ? openChatMessages.length : roomMessages.length]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2000); };

  const handleSend = () => {
    if (!input.trim() || !activeRoomId) return;
    const content = emojiMode ? emojiEncrypt(input.trim()) : input.trim();
    if (activeRoomId === 'general') {
      sendOpenChatMessage(userHandle, content, emojiMode, false, replyingTo?.id || null, replyingTo?.content || null, replyingTo?.sender || null);
    } else {
      sendRoomMessage(activeRoomId, userHandle, content, emojiMode, false, replyingTo?.id || null, replyingTo?.content || null, replyingTo?.sender || null);
    }
    setInput('');
    setEmojiMode(false);
    setReplyingTo(null);
    if (inputRef.current) inputRef.current.style.height = 'auto';
  };

  const handleAttach = async (file: File | undefined) => {
    if (!file || !activeRoomId) return;
    setUploading(true);
    const result = await uploadFile(file);
    setUploading(false);
    if (!result?.url) { showToast(result?.error || "// UPLOAD FAILED //"); return; }
    const packed = packAttachment(file, result.url);
    if (activeRoomId === "general") {
      sendOpenChatMessage(userHandle, packed, false, false, replyingTo?.id || null, replyingTo?.content || null, replyingTo?.sender || null);
    } else {
      sendRoomMessage(activeRoomId, userHandle, packed, false, false, replyingTo?.id || null, replyingTo?.content || null, replyingTo?.sender || null);
    }
    setReplyingTo(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleCreateRoom = async () => {
    if (!roomName.trim()) { showToast("// NAME REQUIRED //"); return; }
    if (roomLocked && !roomPassword.trim()) { showToast("// PASSPHRASE REQUIRED //"); return; }
    const result = await createChatRoom(roomName.trim(), userHandle, userRole, roomLocked, roomLocked ? roomPassword.trim() : null);
    if (result && 'id' in result) {
      setShowCreateRoom(false);
      setRoomName('');
      setRoomLocked(false);
      setRoomPassword('');
      setActiveRoomId(result.id);
      setShowRoomList(false);
      showToast('// ROOM CREATED //');
    } else if (result && 'error' in result) {
      showToast(`// ${(result as { error: string }).error} //`);
    } else {
      showToast('// CREATE FAILED //');
    }
  };

  const handleJoinRoom = (roomId: string, isLocked: boolean) => {
    const room = chatRooms.find((r) => r.id === roomId);
    if (isLocked && room?.creator_handle !== userHandle) {
      setPasswordRoom(roomId);
      return;
    }
    setActiveRoomId(roomId);
    setShowRoomList(false);
  };

  const handleVerifyPassword = async () => {
    if (!passwordRoom || !enterPassword) return;
    try {
      const res = await fetch(`/api/chat-rooms/${passwordRoom}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: enterPassword }),
      });
      const data = await res.json();
      if (data.valid) {
        setActiveRoomId(passwordRoom);
        setShowRoomList(false);
        setPasswordRoom(null);
        setEnterPassword('');
      } else {
        showToast('// WRONG PASSWORD //');
      }
    } catch { showToast('// ERROR //'); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  const activeRoomName = activeRoomId === 'general' ? 'THE LOUNGE' : (chatRooms.find(r => r.id === activeRoomId)?.name || 'Room');
  const activeRoomLocked = activeRoomId !== 'general' ? (chatRooms.find(r => r.id === activeRoomId)?.is_locked === 1) : false;
  const displayMessages = activeRoomId === 'general' ? openChatMessages : roomMessages;

  // Room List View
  if (showRoomList) {
    return (
      <div className="h-full flex flex-col" style={{ background: 'hsl(var(--background))' }}>
        {toast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] px-4 py-2 rounded-lg shadow-lg" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--primary) / 0.3)' }}>
            <span className="font-mono text-xs" style={{ color: 'hsl(var(--primary))' }}>{toast}</span>
          </div>
        )}

        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ background: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}>
          <div className="flex items-center gap-3">
            <Users size={16} style={{ color: 'hsl(var(--primary))' }} />
            <div>
              <h3 className="font-mono text-sm uppercase tracking-wider" style={{ color: 'hsl(var(--foreground))' }}>Chat Rooms</h3>
              <p className="font-mono text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>{chatRooms.length + 1} rooms · open to everyone · clears every 48 hours</p>
            </div>
          </div>
          <button
              onClick={() => setShowCreateRoom(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] uppercase rounded-sm"
              style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
            >
              <Plus size={12} /> Create Room
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {/* General — always at top */}
          <button
            onClick={() => { setActiveRoomId('general'); setShowRoomList(false); }}
            className="w-full flex items-center gap-3 p-3 border rounded-lg text-left transition-all hover:brightness-110"
            style={{ borderColor: 'hsl(var(--primary) / 0.4)', background: 'hsl(var(--card))' }}
          >
            <div className="p-2 rounded-sm flex-shrink-0" style={{ background: 'hsl(var(--primary) / 0.12)' }}>
              <Globe size={16} style={{ color: 'hsl(var(--primary))' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm uppercase tracking-wider" style={{ color: 'hsl(var(--foreground))' }}>The Lounge</span>
                <span className="font-mono text-[8px] px-1.5 py-0.5 rounded-sm" style={{ background: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))' }}>PUBLIC</span>
              </div>
              <p className="font-mono text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>Open to everyone · clears every 48 hours</p>
            </div>
          </button>

          {/* Divider */}
          {chatRooms.length > 0 && (
            <div className="flex items-center gap-2 py-1">
              <div className="flex-1 h-px" style={{ background: 'hsl(var(--border))' }} />
              <span className="font-mono text-[9px] uppercase" style={{ color: 'hsl(var(--muted-foreground))' }}>Custom Rooms</span>
              <div className="flex-1 h-px" style={{ background: 'hsl(var(--border))' }} />
            </div>
          )}

          {/* Custom rooms */}
          {chatRooms.map(room => {
            const isOwn = room.creator_handle === userHandle;
            const isBasicRoom = room.creator_role === 'basic' || !room.creator_role;
            const canDelete = isOwn || userRole === 'admin' || (userRole === 'moderator' && isBasicRoom);
            const canLock = isOwn || userRole === 'admin' || (userRole === 'moderator' && isBasicRoom);

            return (
              <div key={room.id} className="flex items-center gap-2">
                <button
                  onClick={() => handleJoinRoom(room.id, room.is_locked === 1)}
                  className="flex-1 flex items-center gap-3 p-3 border rounded-lg text-left transition-all hover:brightness-110"
                  style={{ borderColor: isOwn ? 'hsl(var(--primary) / 0.4)' : 'hsl(var(--border))', background: 'hsl(var(--card))' }}
                >
                  <div className="p-2 rounded-sm flex-shrink-0" style={{ background: room.is_locked ? 'hsl(var(--destructive) / 0.12)' : 'hsl(var(--muted))' }}>
                    {room.is_locked ? <Lock size={16} style={{ color: 'hsl(var(--destructive))' }} /> : <Hash size={16} style={{ color: 'hsl(var(--muted-foreground))' }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm truncate" style={{ color: 'hsl(var(--foreground))' }}>{room.name}</span>
                      {room.is_locked && <Lock size={10} style={{ color: 'hsl(var(--destructive))' }} />}
                      {room.locked_by && <span className="font-mono text-[8px] px-1 rounded-sm" style={{ background: 'hsl(var(--destructive) / 0.15)', color: 'hsl(var(--destructive))' }}>by {room.locked_by}</span>}
                    </div>
                    <p className="font-mono text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>by {room.creator_handle}</p>
                  </div>
                </button>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {canLock && (
                    <button
                      onClick={async () => {
                        if (room.is_locked) {
                          await unlockChatRoom(room.id);
                          showToast('// ROOM UNLOCKED //');
                        } else {
                          await lockChatRoom(room.id, userHandle, 'Locked by ' + userRole);
                          showToast('// ROOM LOCKED //');
                        }
                        fetchChatRooms();
                      }}
                      className="p-2 rounded-lg transition-all hover:brightness-110"
                      style={{ color: room.is_locked ? 'hsl(142, 76%, 36%)' : 'hsl(45, 90%, 40%)' }}
                      title={room.is_locked ? 'Unlock' : 'Lock'}
                    >
                      <Lock size={14} />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={async () => {
                        if (window.confirm(`Delete "${room.name}"? All messages will be lost.`)) {
                          await deleteChatRoom(room.id);
                          if (activeRoomId === room.id) setActiveRoomId('general');
                          showToast('// ROOM DELETED //');
                        }
                      }}
                      className="p-2 rounded-lg transition-all hover:brightness-110"
                      style={{ color: 'hsl(var(--destructive))' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Create Room Modal */}
        {showCreateRoom && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
            <div className="w-full max-w-sm p-5 border rounded-lg space-y-4" style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--primary) / 0.3)' }}>
              <div className="flex items-center justify-between">
                <h3 className="font-mono text-sm uppercase tracking-wider" style={{ color: 'hsl(var(--primary))' }}>Create Room</h3>
                <button onClick={() => setShowCreateRoom(false)} className="p-1" style={{ color: 'hsl(var(--muted-foreground))' }}><X size={16} /></button>
              </div>
              <p className="font-mono text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>Open rooms are for everyone. Lock one with a passphrase. Every room still clears every 48 hours.</p>
              <input
                type="text"
                value={roomName}
                onChange={e => setRoomName(e.target.value)}
                placeholder="Room name..."
                className="w-full p-2.5 rounded-md font-mono text-sm focus:outline-none"
                style={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' }}
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setRoomLocked(!roomLocked)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-sm font-mono text-[10px] uppercase border transition-all ${roomLocked ? 'bg-blood/10' : ''}`}
                  style={roomLocked ? { borderColor: 'hsl(var(--destructive))', color: 'hsl(var(--destructive))' } : { borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}
                >
                  <Lock size={12} /> {roomLocked ? 'Locked' : 'Unlocked'}
                </button>
                {roomLocked && (
                  <input
                    type="password"
                    value={roomPassword}
                    onChange={e => setRoomPassword(e.target.value)}
                    placeholder="Password..."
                    className="flex-1 p-2 rounded-md font-mono text-xs focus:outline-none"
                    style={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--destructive) / 0.3)', color: 'hsl(var(--foreground))' }}
                  />
                )}
              </div>
              <button
                onClick={handleCreateRoom}
                disabled={!roomName.trim()}
                className="w-full py-2.5 font-mono text-xs uppercase rounded-sm transition-all disabled:opacity-30"
                style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
              >
                Create Room
              </button>
            </div>
          </div>
        )}

        {/* Password Entry Modal */}
        {passwordRoom && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
            <div className="w-full max-w-sm p-5 border rounded-lg space-y-4" style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--destructive) / 0.3)' }}>
              <div className="flex items-center gap-2">
                <Lock size={16} style={{ color: 'hsl(var(--destructive))' }} />
                <h3 className="font-mono text-sm uppercase tracking-wider" style={{ color: 'hsl(var(--destructive))' }}>Locked Room</h3>
              </div>
              <input
                type="password"
                value={enterPassword}
                onChange={e => setEnterPassword(e.target.value)}
                placeholder="Enter password..."
                className="w-full p-2.5 rounded-md font-mono text-sm focus:outline-none"
                style={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--destructive) / 0.3)', color: 'hsl(var(--foreground))' }}
                onKeyDown={e => { if (e.key === 'Enter') handleVerifyPassword(); }}
              />
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => { setPasswordRoom(null); setEnterPassword(''); }}
                    className="flex-1 py-2 font-mono text-xs uppercase rounded-sm border"
                    style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleVerifyPassword}
                    className="flex-1 py-2 font-mono text-xs uppercase rounded-sm"
                    style={{ background: 'hsl(var(--destructive))', color: 'white' }}
                  >
                    Enter
                  </button>
                </div>
                {/* Bypass Lock for mod/admin */}
                {(userRole === 'admin' || userRole === 'moderator') && (
                  <button
                    onClick={() => {
                      setActiveRoomId(passwordRoom);
                      setShowRoomList(false);
                      setPasswordRoom(null);
                      setEnterPassword('');
                      showToast('// LOCK BYPASSED //');
                    }}
                    className="w-full py-2 font-mono text-xs uppercase rounded-sm border"
                    style={{ borderColor: 'hsl(var(--primary) / 0.5)', color: 'hsl(var(--primary))' }}
                  >
                    {userRole === 'admin' ? 'Admin Bypass' : 'Mod Bypass'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Active Room Chat View
  return (
    <div className="flex-1 flex flex-col h-full overflow-x-hidden" style={{ background: 'hsl(var(--background))' }}>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] px-4 py-2 rounded-lg shadow-lg" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--primary) / 0.3)' }}>
          <span className="font-mono text-xs" style={{ color: 'hsl(var(--primary))' }}>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b z-10" style={{ background: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}>
        <button onClick={() => { setActiveRoomId(null); setShowRoomList(true); }} className="p-1 flex-shrink-0" style={{ color: 'hsl(var(--muted-foreground))' }}>
          <ChevronLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-mono text-sm uppercase tracking-wider truncate" style={{ color: 'hsl(var(--foreground))' }}>{activeRoomName}</h3>
            {activeRoomLocked && <Lock size={12} style={{ color: 'hsl(var(--destructive))' }} />}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] tracking-wider" style={{ color: 'hsl(var(--primary) / 0.7)' }}>
              {displayMessages.length} MESSAGES · OPEN TO EVERYONE · CLEARS EVERY 48 HOURS
            </span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3 min-w-0">
        {displayMessages.map((msg) => (
          <RoomBubble
            key={msg.id}
            msg={msg}
            isMe={msg.sender_handle === userHandle || msg.sender_handle === 'ANON'}
            currentUserHandle={userHandle}
            onReply={(id, content, sender) => { setReplyingTo({ id, content, sender }); inputRef.current?.focus(); }}
            onViewUser={(h) => setProfileUser({ handle: h })}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Profile Modal */}
      <UserProfileModal
        isOpen={!!profileUser}
        onClose={() => setProfileUser(null)}
        user={{ handle: profileUser?.handle || '' }}
        onMessage={async (h) => {
          if (h === userHandle) { showToast('// CANNOT MESSAGE YOURSELF //'); setProfileUser(null); return; }
          try {
            const conv = await createConversation(userHandle, h);
            await fetchConversations(userHandle);
            if (conv && conv.id) {
              setActiveConversation(String(conv.id));
            }
            setActiveTab('message');
            showToast(`// OPENING: ${h} //`);
          } catch { showToast('// FAILED TO OPEN CHAT //'); }
          setProfileUser(null);
        }}
        onAddContact={(h) => {
          const existing = JSON.parse(localStorage.getItem('omerta_contacts_v2') || '[]');
          if (!existing.includes(h)) {
            localStorage.setItem('omerta_contacts_v2', JSON.stringify([...existing, h]));
          }
          showToast(`// ADDED TO CONTACTS: ${h} //`);
          setProfileUser(null);
        }}
        onViewProfile={(h) => {
          setViewingProfile(h);
          setActiveTab('profile');
          showToast(`// VIEWING: ${h} //`);
          setProfileUser(null);
        }}
      />

      {/* Reply banner */}
      {replyingTo && (
        <div className="px-3 py-2 border-t flex items-center justify-between" style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}>
          <div className="flex items-center gap-2 min-w-0">
            <Reply size={12} style={{ color: 'hsl(var(--primary))' }} />
            <span className="font-mono text-[10px] uppercase tracking-wider truncate" style={{ color: 'hsl(var(--muted-foreground))' }}>
              Replying to {replyingTo.sender === userHandle ? 'You' : replyingTo.sender}
            </span>
          </div>
          <button onClick={() => setReplyingTo(null)} className="p-1" style={{ color: 'hsl(var(--muted-foreground))' }}><X size={14} /></button>
        </div>
      )}

      {/* Input */}
      <div className="px-3 py-3 border-b z-10" style={{ background: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}>
        <div className="flex items-end gap-2">
          <input ref={fileRef} type="file" accept="image/*,.pdf,.txt,.zip,.doc,.docx,.mp3,.mp4" className="hidden" onChange={(e) => { void handleAttach(e.target.files?.[0]); }} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="p-2 rounded-md border flex-shrink-0 disabled:opacity-40" style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }} title="Attach a photo or file">
            <Paperclip size={16} />
          </button>
          <div className="flex-1 min-w-0">
            <textarea ref={inputRef} value={input} onChange={handleChange} onKeyDown={handleKeyDown}
              placeholder={replyingTo ? 'Write a reply...' : `Send to ${activeRoomName.toLowerCase()}...`} rows={1}
              className="w-full rounded-lg px-3 py-2.5 font-mono text-sm focus:outline-none resize-none max-h-32 scrollbar-hide"
              style={{ minHeight: '40px', background: 'hsl(var(--input))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' }} />
          </div>
          <button onClick={() => setEmojiMode(!emojiMode)}
            className={`p-2 transition-colors flex-shrink-0 rounded-md border ${emojiMode ? 'bg-blood/10' : ''}`}
            style={emojiMode ? { borderColor: 'hsl(var(--primary))', color: 'hsl(var(--primary))' } : { borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}
            title="Emoji encrypt">
            <span className="text-sm">🔒</span>
          </button>
          <button onClick={handleSend} disabled={!input.trim()}
            className="p-2.5 rounded-lg hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex-shrink-0"
            style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
