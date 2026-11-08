import { useApp } from '@omerta/store/AppContext';
import { useApi } from '@omerta/store/ApiContext';
import { useState, useRef, useEffect } from 'react';
import { Lock, Flame, Send, Paperclip, ChevronLeft, Reply, Pencil, Trash2, X, MoreVertical, Shield } from 'lucide-react';
import { ScrambleText } from '@omerta/hooks/useScrambleText';
import { useLongPress } from '@omerta/hooks/useLongPress';
import { emojiEncrypt, emojiDecrypt } from '@omerta/utils/emojiCipher';
import { importPrivateKey, openPrivate } from '@omerta/utils/crypto';
import { AttachmentView, attachmentLabel, packAttachment } from '@omerta/components/Attachment';
import UserProfileModal from '@omerta/components/UserProfileModal';

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts: number) {
  const d = new Date(ts);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function BurnParticles({ onComplete }: { onComplete: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 200;
    canvas.height = 200;

    const particles: { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number }[] = [];
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: 100 + (Math.random() - 0.5) * 80,
        y: 100 + (Math.random() - 0.5) * 30,
        vx: (Math.random() - 0.5) * 2,
        vy: -Math.random() * 3 - 1,
        life: 0,
        maxLife: 30 + Math.random() * 30,
        size: 2 + Math.random() * 4,
      });
    }

    let anim = 0;
    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, 200, 200);
      let alive = 0;

      for (const p of particles) {
        if (p.life >= p.maxLife) continue;
        alive++;
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.98;
        p.vy *= 0.98;

        const alpha = 1 - p.life / p.maxLife;
        ctx.fillStyle = `rgba(180, 160, 120, ${alpha * 0.6})`;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }

      if (alive > 0) {
        anim = requestAnimationFrame(draw);
      } else {
        onComplete();
      }
    }

    anim = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(anim);
  }, [onComplete]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-10"
      style={{ width: '100%', height: '100%' }}
    />
  );
}

function MessageBubble({
  message,
  selectedAvatar,
  partnerAvatar,
  partnerInitials,
  partnerColor,
  currentUserHandle,
  onBurn,
  onEdit,
  onDelete,
  onReply,
  isReplying,
  onViewProfile,
  onViewSelf,
}: {
  message: import('@omerta/types').Message;
  selectedAvatar: string | null;
  partnerAvatar?: string | null;
  partnerInitials: string;
  partnerColor: string;
  currentUserHandle: string;
  onBurn: () => void;
  onEdit: (id: string, newContent: string) => void;
  onDelete: (id: string) => void;
  onReply: (id: string, content: string, sender: string) => void;
  isReplying: boolean;
  onViewProfile?: () => void;
  onViewSelf?: () => void;
}) {
  const [burning, setBurning] = useState(false);
  const [visible, setVisible] = useState(true);
  const [decrypted, setDecrypted] = useState(false);
  const viewed = useRef(false);
  const [e2ePlaintext, setE2ePlaintext] = useState<string | null>(null);
  const [e2eDecrypting, setE2eDecrypting] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const [replyText, setReplyText] = useState('');

  // Auto-decrypt E2E messages
  useEffect(() => {
    if (!message.isE2EEncrypted || e2ePlaintext || e2eDecrypting) return;
    setE2eDecrypting(true);
    let dead = false;
    fetch("/api/keys/mine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle: currentUserHandle }),
    })
      .then((res) => res.json())
      .then(async (mine) => {
        if (!mine?.privateKey || !mine?.publicKey) return null;
        const payload = JSON.parse(message.content);
        const pairs = [{ publicKey: mine.publicKey, privateKey: mine.privateKey }, ...(Array.isArray(mine.history) ? mine.history : [])];
        for (const pair of pairs) {
          if (!pair?.privateKey || !pair?.publicKey) continue;
          try { return await openPrivate(payload, await importPrivateKey(pair.privateKey), pair.publicKey); } catch { /* this session key did not seal it */ }
        }
        return null;
      })
      .then((opened) => { if (!dead && opened) setE2ePlaintext(opened.body); })
      .catch(() => {})
      .finally(() => { if (!dead) setE2eDecrypting(false); });
    return () => { dead = true; };
  }, [message.isE2EEncrypted, message.content, currentUserHandle]);

  const { handlers } = useLongPress({
    ms: 500,
    onLongPress: () => {
      if (message.isEmojiEncrypted && !message.isBurned) {
        setDecrypted(true);
        viewed.current = true;
      }
    },
    onRelease: () => {
      if (message.isEmojiEncrypted) setDecrypted(false);
      if (!viewed.current) return;
      viewed.current = false;
      fetch("/api/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "dm", id: message.id, handle: currentUserHandle }),
      }).then((res) => res.json()).then((data) => {
        if (data.burned) onBurn();
      }).catch(() => {});
    },
  });

  if (!visible) return null;

  const isSystem = message.isSystem;
  const isSent = message.isSent;
  const isBurned = message.isBurned;
  const isDeleted = message.deleted;

  if (isSystem) {
    return (
      <div className="flex justify-center my-3">
        <span className="font-mono text-[10px] tracking-wider uppercase" style={{ color: 'hsl(var(--muted-foreground))' }}>
          <ScrambleText text={message.content} trigger={true} speed={20} />
        </span>
      </div>
    );
  }

  const opened = message.isE2EEncrypted ? e2ePlaintext : message.content;
  const displayContent = message.isE2EEncrypted && !e2ePlaintext
    ? (e2eDecrypting ? "// ENCRYPTED //" : "// ENCRYPTED //")
    : message.isEmojiEncrypted
      ? (decrypted ? (emojiDecrypt(opened || "") || opened || "") : (opened || ""))
      : (opened || "");

  return (
    <div className={`flex ${isSent ? 'justify-end' : 'justify-start'} mb-1 animate-message-in relative group items-end gap-2`}>
      {/* Partner avatar for received messages (left side) */}
      {!isSent && !isSystem && (
        <button
          onClick={onViewProfile}
          className="w-7 h-7 rounded-full flex-shrink-0 overflow-hidden border hover:scale-110 transition-transform"
          style={{ borderColor: 'hsl(var(--primary) / 0.3)' }}
        >
          {partnerAvatar ? (
            <img src={partnerAvatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-serif text-[9px] font-bold text-white" style={{ backgroundColor: partnerColor }}>
              {partnerInitials}
            </div>
          )}
        </button>
      )}

      <div className="max-w-[85%] md:max-w-[75%]">
        {/* Reply indicator */}
        {message.replyTo && message.replyContent && (
          <div className={`mb-1 px-3 py-1.5 rounded-lg ${isSent ? 'ml-auto' : 'mr-auto'}`} style={{ background: 'hsl(var(--reply-quote-bg))', border: '1px solid hsl(var(--reply-quote-border))' }}>
            <div className="flex items-center gap-1.5 mb-0.5">
              <Reply size={10} style={{ color: 'hsl(var(--primary) / 0.6)' }} />
              <span className="font-mono text-[9px] uppercase tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>
                Replying to {message.replySender === currentUserHandle ? 'You' : (message.replySender || 'unknown')}
              </span>
            </div>
            <p className="font-mono text-[11px] truncate" style={{ color: 'hsl(var(--bubble-meta))' }}>{message.replyContent}</p>
          </div>
        )}

        {/* Main bubble */}
        <div
          {...(message.isEmojiEncrypted ? handlers : {})}
          onClick={() => !isEditing && setShowActions(!showActions)}
          className={`relative px-3.5 py-2.5 rounded-2xl shadow-message select-none cursor-pointer`}
          style={{
            background: isSent ? 'hsl(var(--bubble-sent-bg))' : 'hsl(var(--bubble-recv-bg))',
            border: isSent ? 'var(--bubble-sent-outline) solid hsl(var(--bubble-sent-border))' : 'var(--bubble-recv-outline) solid hsl(var(--bubble-recv-border))',
            borderRadius: isSent ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem',
          }}
        >
          {burning && <BurnParticles onComplete={() => setVisible(false)} />}

          <div className="flex items-start gap-2">
            {message.burnAfterRead && !isBurned && (
              <span title="Click to burn">
                <Flame
                  size={12}
                  className="mt-0.5 flex-shrink-0 cursor-pointer transition-colors"
                  style={{ color: 'hsl(var(--destructive))' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setBurning(true);
                    setTimeout(onBurn, 600);
                  }}
                />
              </span>
            )}
            {isBurned && (
              <Flame size={12} className="mt-0.5 flex-shrink-0" style={{ color: 'hsl(var(--muted-foreground))' }} />
            )}

            {isEditing ? (
              <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={2}
                  className="w-full rounded-md px-2 py-1.5 font-mono text-sm focus:outline-none resize-none"
                  style={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                />
                <div className="flex items-center gap-2 mt-1.5">
                  <button
                    onClick={() => { onEdit(message.id, editText); setIsEditing(false); setShowActions(false); }}
                    className="px-2 py-1 font-mono text-[10px] uppercase rounded-sm"
                    style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
                  >Save</button>
                  <button
                    onClick={() => { setIsEditing(false); setEditText(message.content); }}
                    className="px-2 py-1 font-mono text-[10px] uppercase rounded-sm"
                    style={{ border: '1px solid hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}
                  >Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ color: 'hsl(var(--bubble-text))' }}>
                <AttachmentView content={displayContent} />
                {message.edited && !isDeleted && <span className="text-[10px] ml-1" style={{ color: 'hsl(var(--muted-foreground))' }}>(edited)</span>}
              </div>
            )}
          </div>

          <div className={`flex items-center gap-1.5 mt-1.5 ${isSent ? 'justify-end' : 'justify-start'}`}>
            <span className="font-mono text-[10px] whitespace-nowrap" style={{ color: 'hsl(var(--bubble-meta))' }}>
              {formatTime(message.timestamp)}
            </span>
            {!isBurned && !isDeleted && message.isE2EEncrypted && (
              <Shield size={10} className="flex-shrink-0" style={{ color: 'hsl(142, 76%, 36%)' }} />
            )}
            {!isBurned && !isDeleted && !message.isE2EEncrypted && (
              <Lock size={10} className="flex-shrink-0" style={{ color: 'hsl(var(--primary) / 0.5)' }} />
            )}
          </div>
          {message.isE2EEncrypted && !e2ePlaintext && (
            <div className="absolute -top-1.5 -right-1.5 px-1 py-px rounded-sm" style={{ background: 'hsl(142, 76%, 36%)' }}>
              <span className="font-mono text-[7px] tracking-wider" style={{ color: 'white' }}>E2E</span>
            </div>
          )}
          {message.isEmojiEncrypted && !decrypted && (
            <div className="absolute -top-1.5 -right-1.5 px-1 py-px rounded-sm" style={{ background: 'hsl(var(--primary))' }}>
              <span className="font-mono text-[7px] tracking-wider" style={{ color: 'hsl(var(--primary-foreground))' }}>HOLD</span>
            </div>
          )}
        </div>

        {/* Action bar under bubble */}
        {showActions && !isEditing && !isBurned && !isDeleted && (
          <div className={`flex items-center gap-1 mt-1 ${isSent ? 'justify-end' : 'justify-start'}`} style={{ borderTop: '1px solid hsl(var(--action-bar-border))', paddingTop: '4px' }}>
            <button
              onClick={(e) => { e.stopPropagation(); onReply(message.id, message.content, message.sender); setShowActions(false); }}
              className="p-1 transition-colors hover:brightness-125"
              style={{ color: 'hsl(var(--muted-foreground))' }}
              title="Reply"
            >
              <Reply size={12} />
            </button>
            {isSent && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); setIsEditing(true); setShowActions(false); }}
                  className="p-1 transition-colors hover:brightness-125"
                  style={{ color: 'hsl(var(--muted-foreground))' }}
                  title="Edit"
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(message.id); setShowActions(false); }}
                  className="p-1 transition-colors hover:brightness-125"
                  style={{ color: 'hsl(var(--muted-foreground))' }}
                  title="Delete"
                >
                  <Trash2 size={12} />
                </button>
              </>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setShowActions(false); }}
              className="p-1 transition-colors hover:brightness-125"
              style={{ color: 'hsl(var(--muted-foreground))' }}
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Inline reply composer */}
        {isReplying && (
          <div className="mt-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply..."
              className="flex-1 rounded-md px-2 py-1.5 font-mono text-xs focus:outline-none"
              style={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' }}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && replyText.trim()) {
                  onReply(message.id, replyText.trim(), message.sender);
                  setReplyText('');
                }
              }}
            />
            <button
              onClick={() => { if (replyText.trim()) { onReply(message.id, replyText.trim(), message.sender); setReplyText(''); } }}
              disabled={!replyText.trim()}
              className="p-1.5 rounded-md transition-all disabled:opacity-30"
              style={{ color: 'hsl(var(--primary))' }}
            >
              <Send size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Sender avatar for sent messages (right side) */}
      {isSent && !isSystem && (
        <button
          onClick={onViewSelf}
          className="w-7 h-7 rounded-full flex-shrink-0 overflow-hidden border hover:scale-110 transition-transform"
          style={{ borderColor: 'hsl(var(--primary) / 0.3)' }}
        >
          {selectedAvatar ? (
            <img src={selectedAvatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-serif text-[9px] font-bold text-white" style={{ background: 'hsl(var(--primary))' }}>
              ME
            </div>
          )}
        </button>
      )}
    </div>
  );
}

export default function ChatWindow({ onBack }: { onBack?: () => void }) {
  const { activeConversationId, sendMessage, burnMessage, editMessage, deleteMessage, userHandle, setActiveTab, setActiveConversation, setViewingProfile, selectedAvatar } = useApp();
  const { uploadFile, sendPrivateMessage, fetchUserProfile, userProfiles, createConversation, fetchConversations, messages, fetchMessages } = useApi();
  const [inputText, setInputText] = useState('');
  const [burnEnabled, setBurnEnabled] = useState(false);
  const [emojiEnabled, setEmojiEnabled] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; content: string; sender?: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [profileUser, setProfileUser] = useState<{ handle: string; avatar?: string | null; createdAt?: number } | null>(null);
  const [partnerProfileData, setPartnerProfileData] = useState<{ handle: string; avatar?: string | null; createdAt?: number } | null>(null);
  const [toast, setToast] = useState('');
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (activeConversationId) fetchMessages(Number(activeConversationId));
  }, [activeConversationId, fetchMessages]);

  useEffect(() => {
    if (!userHandle) return;
    fetch("/api/policy").then((res) => res.json()).then((policy) => {
      if (policy?.burnDefault) setBurnEnabled(true);
    }).catch(() => {});
  }, [userHandle, activeConversationId]);

  // Get conversation metadata from ApiContext
  const { conversations: apiConversations } = useApi();
  const conversationMeta = apiConversations.find(c => String(c.id) === activeConversationId);
  const partnerHandle = conversationMeta ? 
    (conversationMeta.user1_handle === userHandle ? conversationMeta.user2_handle : conversationMeta.user1_handle) 
    : '';

  // Map API messages to display format
  const apiMessages = messages[Number(activeConversationId)] || [];
  const derivedPartner = apiMessages.length > 0
    ? apiMessages.find(m => m.sender_handle !== userHandle)?.sender_handle
    : null;
  const effectivePartner = partnerHandle || derivedPartner;

  const partnerColor = effectivePartner ? `hsl(${Array.from(effectivePartner).reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360}, 70%, 40%)` : 'hsl(var(--primary))';

  // Fetch partner profile for avatar
  useEffect(() => {
    if (effectivePartner) {
      fetchUserProfile(effectivePartner).then(p => {
        if (p) setPartnerProfileData({ handle: p.handle, avatar: p.avatar, createdAt: p.created_at });
      });
    }
  }, [effectivePartner, fetchUserProfile]);

  const partnerProfile = effectivePartner ? userProfiles[effectivePartner] : null;
  const partnerAvatar = partnerProfile?.avatar || null;

  const displayMessages = apiMessages.map(msg => ({
    id: String(msg.id),
    content: msg.content,
    sender: msg.sender_handle === userHandle ? 'me' : msg.sender_handle,
    timestamp: msg.timestamp,
    isSent: msg.sender_handle === userHandle,
    burnAfterRead: msg.burn_after_read === 1,
    isBurned: msg.is_burned === 1,
    isSystem: msg.sender_handle === "notice" || msg.system === 1,
    isEmojiEncrypted: msg.emoji_encrypted === 1,
    isE2EEncrypted: msg.e2e_encrypted === 1,
    replyTo: msg.reply_to ? String(msg.reply_to) : undefined,
    replyContent: msg.reply_content || undefined,
    replySender: msg.reply_sender || undefined,
  }));

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages.length]);

  const handleSend = async () => {
    if (!inputText.trim() || !activeConversationId) return;
    const replyInfo = replyingTo ? { id: replyingTo.id, content: replyingTo.content, sender: replyingTo.sender } : undefined;
    let contentToSend = inputText.trim();
    if (emojiEnabled) contentToSend = emojiEncrypt(contentToSend);
    sendMessage(contentToSend, burnEnabled, emojiEnabled, true, replyInfo);
    await sendPrivateMessage(Number(activeConversationId), userHandle, contentToSend, burnEnabled, emojiEnabled, true, replyingTo?.id || null, replyingTo?.content || null, replyingTo?.sender || null);
    await fetchMessages(Number(activeConversationId));
    setInputText('');
    setBurnEnabled(false);
    setEmojiEnabled(false);
    setReplyingTo(null);
    if (inputRef.current) inputRef.current.style.height = 'auto';
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversationId) return;
    setUploading(true);
    const result = await uploadFile(file);
    setUploading(false);
    if (result?.url) {
      await sendPrivateMessage(
        Number(activeConversationId),
        userHandle,
        packAttachment(file, result.url),
        burnEnabled,
        false,
        true,
        replyingTo?.id ? String(replyingTo.id) : null,
        replyingTo?.content || null,
        replyingTo?.sender || null,
      );
      await fetchMessages(Number(activeConversationId));
      setReplyingTo(null);
    } else {
      showToast(result?.error || '// UPLOAD FAILED //');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  };

  if (!activeConversationId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center" style={{ background: 'hsl(var(--background))' }}>
        <div className="text-center">
          <Lock size={48} className="mx-auto mb-4" style={{ color: 'hsl(var(--muted))' }} />
          <h2 className="font-serif text-3xl mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>Select a Conversation</h2>
          <p className="font-mono text-xs tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>// CHOOSE YOUR CONTACT //</p>
        </div>
      </div>
    );
  }

  if (!effectivePartner) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center" style={{ background: 'hsl(var(--background))' }}>
        <div className="text-center animate-pulse">
          <Lock size={32} className="mx-auto mb-3" style={{ color: 'hsl(var(--primary) / 0.5)' }} />
          <p className="font-mono text-xs tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>// LOADING CONVERSATION //</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full min-w-0" style={{ background: 'hsl(var(--background))' }}>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] px-4 py-2 rounded-lg shadow-lg" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--primary) / 0.3)' }}>
          <span className="font-mono text-xs" style={{ color: 'hsl(var(--primary))' }}>{toast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b z-10" style={{ background: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}>
        {/* Back button — exits conversation */}
        {onBack && (
          <button
            onClick={() => { setActiveConversation(''); onBack(); }}
            className="p-1.5 -ml-1 transition-colors flex-shrink-0"
            style={{ color: 'hsl(var(--muted-foreground))' }}
          >
            <ChevronLeft size={22} />
          </button>
        )}
        <button
          onClick={() => setProfileUser({ handle: effectivePartner, avatar: partnerAvatar, createdAt: partnerProfileData?.createdAt })}
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 hover:scale-110 transition-transform overflow-hidden border"
          style={{ borderColor: 'hsl(var(--primary) / 0.4)' }}
        >
          {partnerAvatar ? (
            <img src={partnerAvatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-serif text-xs font-bold text-white" style={{ backgroundColor: partnerColor }}>
              {effectivePartner.slice(0, 2)}
            </div>
          )}
        </button>
        <div className="min-w-0">
          <h3 className="font-mono text-sm uppercase tracking-wider truncate" style={{ color: 'hsl(var(--foreground))' }}>
            {effectivePartner}
          </h3>
          <div className="flex items-center gap-1.5">
            <Lock size={10} className="flex-shrink-0" style={{ color: 'hsl(var(--primary))' }} />
            <span className="font-mono text-[10px] tracking-wider whitespace-nowrap" style={{ color: 'hsl(var(--primary) / 0.7)' }}>
              AES-256 · SECURE
            </span>
          </div>
        </div>
        <button className="ml-auto p-2 transition-colors flex-shrink-0" style={{ color: 'hsl(var(--muted-foreground))' }}>
          <MoreVertical size={18} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 md:px-4 py-3 md:py-4 space-y-3 min-w-0" style={{ background: 'hsl(var(--background))' }}>
        <div className="flex justify-center mb-4">
          <span className="font-mono text-[10px] tracking-wider uppercase px-3 py-1 rounded-full whitespace-nowrap" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}>
            {formatDate(Date.now())}
          </span>
        </div>

        {displayMessages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            selectedAvatar={selectedAvatar}
            partnerAvatar={partnerAvatar}
            partnerInitials={effectivePartner.slice(0, 2)}
            partnerColor={partnerColor}
            onViewProfile={() => setProfileUser({ handle: effectivePartner, avatar: partnerAvatar, createdAt: partnerProfileData?.createdAt })}
            onViewSelf={() => setProfileUser({ handle: userHandle, avatar: selectedAvatar, createdAt: undefined })}
            onBurn={() => burnMessage(activeConversationId!, msg.id)}
            onEdit={(id, newContent) => editMessage(activeConversationId!, id, newContent)}
            onDelete={(id) => deleteMessage(activeConversationId!, id)}
            onReply={(id, content, sender) => setReplyingTo({ id, content, sender })}
            isReplying={replyingTo?.id === msg.id}
            currentUserHandle={userHandle}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className="px-3 md:px-4 py-3 border-b z-10" style={{ background: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}>
        <div className="flex items-end gap-2">
          <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip,.rar" onChange={handleFileUpload} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="p-2 transition-colors flex-shrink-0 rounded-md border hover:brightness-110 disabled:opacity-40"
            style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}
            title="Attach file"
          >
            {uploading ? <span className="font-mono text-[8px] animate-pulse">UP</span> : <Paperclip size={18} />}
          </button>
          <div className="flex-1 min-w-0">
            {replyingTo && (
              <div className="flex items-center gap-2 mb-1.5 px-1">
                <Reply size={10} style={{ color: 'hsl(var(--primary) / 0.6)' }} />
                <span className="font-mono text-[10px] truncate" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  Replying to {replyingTo.sender || 'message'}: {attachmentLabel(replyingTo.content).slice(0, 40)}
                </span>
                <button onClick={() => setReplyingTo(null)} style={{ color: 'hsl(var(--muted-foreground))' }}>
                  <X size={10} />
                </button>
              </div>
            )}
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={replyingTo ? "Write your reply..." : "type..."}
              rows={1}
              className="w-full rounded-lg px-3 py-2.5 font-mono text-sm focus:outline-none resize-none max-h-32 transition-colors scrollbar-hide"
              style={{ minHeight: '40px', background: 'hsl(var(--input))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' }}
            />
          </div>

          <button
            onClick={() => setEmojiEnabled(!emojiEnabled)}
            className={`p-2 transition-colors flex-shrink-0 rounded-md border ${emojiEnabled ? 'bg-blood/10' : ''}`}
            style={emojiEnabled ? { borderColor: 'hsl(var(--primary))', color: 'hsl(var(--primary))' } : { borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}
            title="Emoji encrypt"
          >
            <span className="text-sm">🔒</span>
          </button>

          <button
            type="button"
            className="p-2 flex-shrink-0 rounded-md border"
            style={{ borderColor: 'hsl(142, 76%, 36%)', color: 'hsl(142, 76%, 36%)' }}
            title="End to end encrypted"
          >
            <Shield size={18} />
          </button>

          <button
            onClick={() => setBurnEnabled(!burnEnabled)}
            className="p-2 transition-colors flex-shrink-0"
            style={{ color: burnEnabled ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }}
            title="Burn after read"
          >
            <Flame size={18} />
          </button>

          <button
            onClick={handleSend}
            disabled={!inputText.trim()}
            className="p-2.5 rounded-lg hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex-shrink-0"
            style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
          >
            <Send size={16} />
          </button>
        </div>
        <div className="flex items-center justify-between mt-2 px-1">
          <span className="font-mono text-[10px] truncate" style={{ color: 'hsl(var(--muted-foreground))' }}>
            {userHandle}
          </span>
          <div className="flex items-center gap-3 flex-shrink-0">
            {emojiEnabled && (
              <span className="font-mono text-[10px] animate-pulse whitespace-nowrap" style={{ color: 'hsl(var(--primary))' }}>
                // EMOJI ENCRYPTION //
              </span>
            )}
            <span className="font-mono text-[10px] whitespace-nowrap" style={{ color: 'hsl(142, 76%, 36%)' }}>
              // END TO END //
            </span>
            {burnEnabled && (
              <span className="font-mono text-[10px] animate-pulse whitespace-nowrap" style={{ color: 'hsl(var(--destructive))' }}>
                // BURN AFTER READ //
              </span>
            )}
          </div>
        </div>
      </div>

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={!!profileUser}
        onClose={() => setProfileUser(null)}
        user={{ handle: profileUser?.handle || '', avatar: profileUser?.avatar, createdAt: profileUser?.createdAt }}
        onMessage={async (h) => {
          const conv = await createConversation(userHandle, h);
          if (conv) {
            await fetchConversations(userHandle);
            setActiveConversation(String(conv.id));
          }
          setActiveTab('message');
          setToast(`// OPENING: ${h} //`);
          setTimeout(() => setToast(''), 2000);
          setProfileUser(null);
        }}
        onAddContact={(h) => {
          const existing = JSON.parse(localStorage.getItem('omerta_contacts_v2') || '[]');
          if (!existing.includes(h)) {
            localStorage.setItem('omerta_contacts_v2', JSON.stringify([...existing, h]));
          }
          setToast(`// ADDED TO CONTACTS: ${h} //`);
          setTimeout(() => setToast(''), 2000);
          setProfileUser(null);
        }}
        onViewProfile={(h) => { setViewingProfile(h); setActiveTab('profile'); setToast(`// VIEWING: ${h} //`); setTimeout(() => setToast(''), 2000); setProfileUser(null); }}
      />
    </div>
  );
}
