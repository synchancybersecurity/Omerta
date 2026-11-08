import { useState, useEffect, useRef } from 'react';
import { useApp } from '@/store/AppContext';
import { useApi } from '@/store/ApiContext';
import {
  Heart, MessageCircle, Share2, Send, Lock, Flame, Globe, MoreHorizontal,
  Users, Shield, Pencil, Trash2, X, ChevronDown, ChevronUp, UserCircle, Hash,
} from 'lucide-react';
import { emojiEncrypt } from '@/utils/emojiCipher';
import { useLongPress } from '@/hooks/useLongPress';
import EditProfileModal from '@/components/EditProfileModal';
import UserProfileModal from '@/components/UserProfileModal';

const PRESET_AVATARS = [
  // Major Arcana
  { id: 'tarot-fool', name: 'The Fool', path: '/avatars/tarot-fool.jpg' },
  { id: 'tarot-death', name: 'Death', path: '/avatars/tarot-death.jpg' },
  { id: 'tarot-hanged', name: 'The Hanged Man', path: '/avatars/tarot-hanged.jpg' },
  { id: 'tarot-tower', name: 'The Tower', path: '/avatars/tarot-tower.jpg' },
  // Tarot Suits
  { id: 'tarot-wands', name: 'Wands', path: '/avatars/tarot-wands.jpg' },
  { id: 'tarot-cups', name: 'Cups', path: '/avatars/tarot-cups.jpg' },
  { id: 'tarot-swords', name: 'Swords', path: '/avatars/tarot-swords.jpg' },
  { id: 'tarot-pentacles', name: 'Pentacles', path: '/avatars/tarot-pentacles.jpg' },
  // Zodiac
  { id: 'zodiac-aries', name: 'Aries', path: '/avatars/zodiac-aries.jpg' },
  { id: 'zodiac-taurus', name: 'Taurus', path: '/avatars/zodiac-taurus.jpg' },
  { id: 'zodiac-gemini', name: 'Gemini', path: '/avatars/zodiac-gemini.jpg' },
  { id: 'zodiac-cancer', name: 'Cancer', path: '/avatars/zodiac-cancer.jpg' },
  { id: 'zodiac-leo', name: 'Leo', path: '/avatars/zodiac-leo.jpg' },
  { id: 'zodiac-virgo', name: 'Virgo', path: '/avatars/zodiac-virgo.jpg' },
  { id: 'zodiac-libra', name: 'Libra', path: '/avatars/zodiac-libra.jpg' },
  { id: 'zodiac-scorpio', name: 'Scorpio', path: '/avatars/zodiac-scorpio.jpg' },
  { id: 'zodiac-sagittarius', name: 'Sagittarius', path: '/avatars/zodiac-sagittarius.jpg' },
  { id: 'zodiac-capricorn', name: 'Capricorn', path: '/avatars/zodiac-capricorn.jpg' },
  { id: 'zodiac-aquarius', name: 'Aquarius', path: '/avatars/zodiac-aquarius.jpg' },
  { id: 'zodiac-pisces', name: 'Pisces', path: '/avatars/zodiac-pisces.jpg' },
];

interface Post {
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
}

interface Reply {
  id: string;
  post_id: string;
  author: string;
  content: string;
  timestamp: number;
}

function PostCard({
  post,
  currentUser,
  selectedAvatar,
  replies,
  onLike,
  onDislike,
  onShare,
  onShareToFeed,
  onShareToRoom,
  onBurn,
  onFetchReplies,
  onCreateReply,
  onEdit,
  onViewProfile,
  authorAvatar,
}: {
  post: Post;
  currentUser: string;
  selectedAvatar: string | null;
  replies: Reply[];
  onLike: (id: string) => void;
  onDislike: (id: string) => void;
  onShare: (id: string) => void;
  onShareToFeed: (post: Post) => void;
  onShareToRoom: (post: Post) => void;
  onBurn: (id: string) => void;
  onFetchReplies: (id: string) => void;
  onCreateReply: (postId: string, content: string) => void;
  onEdit: (post: Post) => void;
  onViewProfile?: (handle: string) => void;
  authorAvatar?: string | null;
}) {
  const [isDecrypted, setIsDecrypted] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [replyText, setReplyText] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  const isEncrypted = post.emoji_encrypted === 1;
  const isBurnAfter = post.burn_after === 1;
  const isBurned = post.is_burned === 1;
  const isMine = post.author === currentUser;
  const replyCount = replies?.length || post.comments || 0;

  const hasLiked = post.liked_by?.includes(currentUser) || false;
  const hasDisliked = post.disliked_by?.includes(currentUser) || false;

  const encryptedText = emojiEncrypt(post.content);
  const displayContent = isEncrypted && !isDecrypted ? encryptedText : post.content;

  const longPress = useLongPress({
    onLongPress: () => { if (isEncrypted) setIsDecrypted(true); },
    onRelease: () => { if (isEncrypted) setIsDecrypted(false); },
    ms: 600,
  });

  const toggleReplies = () => {
    if (!showReplies) {
      onFetchReplies(post.id);
    }
    setShowReplies(!showReplies);
  };

  const handleReply = () => {
    if (!replyText.trim()) return;
    onCreateReply(post.id, replyText.trim());
    setReplyText('');
  };

  useEffect(() => {
    function clickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, []);

  return (
    <div className="border-b transition-all" style={{ borderColor: 'hsl(var(--border))', ...(isBurned ? { opacity: 0.3, pointerEvents: 'none' } : {}) }}>
      {/* Author header */}
      <div className="flex items-center gap-2.5 px-4 md:px-6 py-3">
        <button
          onClick={() => onViewProfile?.(post.author)}
          className="w-8 h-8 rounded-full object-cover flex-shrink-0 border overflow-hidden hover:scale-110 transition-transform"
          style={{ borderColor: 'hsl(var(--primary) / 0.4)' }}
        >
          {(post.author_avatar || authorAvatar) ? (
            <img src={post.author_avatar || authorAvatar || ''} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ background: 'hsl(var(--primary))' }}>
              <span className="font-serif text-[11px] font-bold text-white">{post.author.charAt(0)}</span>
            </div>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <button onClick={() => onViewProfile?.(post.author)}>
              <h3 className="font-serif text-sm tracking-wider hover:underline" style={{ color: 'hsl(var(--foreground))' }}>{post.author}</h3>
            </button>
            <span className="font-mono text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>{post.author_handle}</span>
          </div>
          <p className="font-mono text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>{formatTime(post.timestamp)}</p>
        </div>
        <div className="relative flex-shrink-0" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="transition-colors p-1"
            style={{ color: 'hsl(var(--muted-foreground))' }}
          >
            <MoreHorizontal size={16} />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-36 rounded-md shadow-lg z-50 py-1" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
              {isMine && (
                <button
                  onClick={() => { onEdit(post); setShowMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 font-mono text-xs transition-all text-left"
                  style={{ color: 'hsl(var(--card-foreground))' }}
                >
                  <Pencil size={14} style={{ color: 'hsl(var(--primary))' }} />
                  Edit Post
                </button>
              )}
              {isMine && (
                <button
                  onClick={() => { onBurn(post.id); setShowMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 font-mono text-xs transition-all text-left"
                  style={{ color: 'hsl(var(--destructive))' }}
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              )}
              {!isMine && (
                <button
                  onClick={() => { onBurn(post.id); setShowMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 font-mono text-xs transition-all text-left"
                  style={{ color: 'hsl(var(--destructive))' }}
                >
                  <Flame size={14} />
                  Report/Burn
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 md:px-6 pb-3">
        <p
          className={`font-mono text-sm leading-relaxed break-words ${
            isEncrypted && !isDecrypted ? 'tracking-widest text-lg' : ''
          }`}
          style={{ color: 'hsl(var(--card-foreground))' }}
          {...(isEncrypted ? longPress.handlers : {})}
        >
          {displayContent}
        </p>
        {isEncrypted && (
          <p className="font-mono text-[10px] mt-1" style={{ color: isDecrypted ? 'hsl(142, 76%, 36%)' : 'hsl(var(--primary))' }}>
            {isDecrypted ? '// DECRYPTED //' : '// HOLD TO DECRYPT //'}
          </p>
        )}
      </div>

      {/* Burn indicator */}
      {isBurnAfter && !isBurned && (
        <div className="px-4 md:px-6 pb-2 flex items-center gap-1.5">
          <Flame size={10} style={{ color: 'hsl(var(--primary))' }} />
          <span className="font-mono text-[10px]" style={{ color: 'hsl(var(--primary))' }}>BURN AFTER READ</span>
        </div>
      )}

      {/* Action bar */}
      <div className="px-4 md:px-6 pb-3 flex items-center gap-4">
        {/* Like / Dislike */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onLike(post.id)}
            className="flex items-center gap-1 transition-all"
            style={{ color: hasLiked ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }}
            title={hasLiked ? 'Unlike' : 'Like'}
          >
            <Heart size={15} />
            <span className="font-mono text-[10px]">{post.likes || 0}</span>
          </button>
          <span className="mx-0.5" style={{ color: 'hsl(var(--muted))' }}>|</span>
          <button
            onClick={() => onDislike(post.id)}
            className="flex items-center gap-1 transition-all"
            style={{ color: hasDisliked ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }}
            title={hasDisliked ? 'Remove dislike' : 'Dislike'}
          >
            <span className="font-mono text-[13px] leading-none">{hasDisliked ? '💔' : '🖤'}</span>
            <span className="font-mono text-[10px]">{post.dislikes || 0}</span>
          </button>
        </div>

        {/* Replies */}
        <button
          onClick={toggleReplies}
          className="flex items-center gap-1 transition-all"
          style={{ color: showReplies ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))' }}
        >
          {showReplies ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          <MessageCircle size={15} />
          <span className="font-mono text-[10px]">{replyCount}</span>
        </button>

        {/* Share */}
        <button onClick={() => { onShareToFeed(post); onShare(post.id); }} className="flex items-center gap-1 transition-all" style={{ color: 'hsl(var(--muted-foreground))' }}>
          <Share2 size={15} />
          <span className="font-mono text-[10px]">{post.shares || 0}</span>
        </button>

        {/* Share to Room */}
        <button onClick={() => onShareToRoom(post)} className="flex items-center gap-1 transition-all" style={{ color: 'hsl(var(--primary) / 0.7)' }} title="Share to chat room">
          <Hash size={15} />
          <span className="font-mono text-[10px]">ROOM</span>
        </button>

        {isEncrypted && <Lock size={12} className="ml-auto" style={{ color: 'hsl(var(--primary) / 0.6)' }} />}
      </div>

      {/* Reply Thread */}
      {showReplies && (
        <div className="border-t" style={{ background: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}>
          {replies && replies.length > 0 ? (
            <div className="px-4 md:px-6 py-2 space-y-2">
              {replies.map((reply) => (
                <div key={reply.id} className="flex items-start gap-2 py-1.5 border-l-2 pl-3" style={{ borderColor: 'hsl(var(--primary) / 0.2)' }}>
                  {selectedAvatar ? (
                    <img src={selectedAvatar} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0 mt-0.5 border" style={{ borderColor: 'hsl(var(--primary) / 0.3)' }} />
                  ) : (
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'hsl(var(--muted))' }}>
                      <span className="font-serif text-[8px] font-bold text-white">{reply.author.charAt(0)}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-medium" style={{ color: 'hsl(var(--foreground))' }}>{reply.author}</span>
                      <span className="font-mono text-[9px]" style={{ color: 'hsl(var(--muted-foreground))' }}>{formatTime(reply.timestamp)}</span>
                    </div>
                    <p className="font-mono text-xs break-words leading-relaxed" style={{ color: 'hsl(var(--card-foreground))' }}>{reply.content}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 md:px-6 py-3 text-center">
              <p className="font-mono text-[11px]" style={{ color: 'hsl(var(--muted-foreground))' }}>// NO REPLIES YET //</p>
            </div>
          )}

          {/* Reply composer */}
          <div className="px-4 md:px-6 py-3 border-t" style={{ borderColor: 'hsl(var(--border))' }}>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Reply to this post..."
                className="flex-1 rounded-sm px-3 py-2 font-mono text-xs focus:outline-none"
                style={{ background: 'hsl(var(--input))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleReply(); }}
              />
              <button
                onClick={handleReply}
                disabled={!replyText.trim()}
                className="p-2 rounded-sm transition-all disabled:opacity-30"
                style={{ color: 'hsl(var(--primary))' }}
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProfileTab({ mode = 'own' }: { mode?: 'own' | 'feed' }) {
  const { userHandle, editProfile, selectedAvatar, setSelectedAvatar, setActiveTab, setActiveConversation, viewingProfile, setViewingProfile } = useApp();
  const {
    posts, fetchPosts, createPost, deletePost, likePost, dislikePost,
    sharePost, replies, fetchReplies, createReply, fetchUserProfile, userProfiles,
    createConversation, fetchConversations, sendOpenChatMessage, sendRoomMessage, chatRooms, fetchChatRooms, uploadFile,
  } = useApi();

  const [newPostContent, setNewPostContent] = useState('');
  const [emojiMode, setEmojiMode] = useState(false);
  const [burnMode, setBurnMode] = useState(false);
  const [postImageUrl, setPostImageUrl] = useState<string | null>(null);
  const [postUploading, setPostUploading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'encrypted' | 'burned'>('all');
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showRoomPicker, setShowRoomPicker] = useState(false);
  const [selectedPostForShare, setSelectedPostForShare] = useState<Post | null>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editContent, setEditContent] = useState('');
  const [toast, setToast] = useState('');
  const [profileData, setProfileData] = useState<{ handle: string; avatar?: string | null; createdAt?: number } | null>(null);
  const [modalProfileUser, setModalProfileUser] = useState<string | null>(null);

  // Preload avatars for all post authors in the feed
  useEffect(() => {
    const authors = [...new Set(posts.map(p => p.author))];
    authors.forEach(h => { if (h && !userProfiles[h]) fetchUserProfile(h); });
  }, [posts, fetchUserProfile, userProfiles]);

  // Fetch viewing profile user data
  useEffect(() => {
    if (viewingProfile && !userProfiles[viewingProfile]) {
      fetchUserProfile(viewingProfile);
    }
  }, [viewingProfile, fetchUserProfile, userProfiles]);

  // Clear viewingProfile when leaving the Profile tab
  useEffect(() => {
    return () => { setViewingProfile(null); };
  }, []);

  // Pull-to-refresh state
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const touchStartX = useRef(0);
  const isDragging = useRef(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2000); };

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const doRefresh = async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
    setPulling(false);
    setPullDistance(0);
    showToast('// FEED REFRESHED //');
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const el = scrollRef.current;
    if (!el || el.scrollTop > 0) return;
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
    isDragging.current = true;
    setPulling(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const deltaY = e.touches[0].clientY - touchStartY.current;
    const deltaX = Math.abs(e.touches[0].clientX - touchStartX.current);
    if (deltaY > 0 && deltaX < deltaY) {
      const damped = Math.min(deltaY * 0.5, 120);
      setPullDistance(damped);
      if (damped >= 80) {
        // Hold-triggered refresh when held past threshold
      }
    }
  };

  const onTouchEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (pullDistance >= 80) {
      doRefresh();
    } else {
      setPulling(false);
      setPullDistance(0);
    }
  };

  // Mouse fallback for desktop testing
  const onMouseDown = (e: React.MouseEvent) => {
    const el = scrollRef.current;
    if (!el || el.scrollTop > 0) return;
    touchStartY.current = e.clientY;
    touchStartX.current = e.clientX;
    isDragging.current = true;
    setPulling(true);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const deltaY = e.clientY - touchStartY.current;
    const deltaX = Math.abs(e.clientX - touchStartX.current);
    if (deltaY > 0 && deltaX < deltaY) {
      const damped = Math.min(deltaY * 0.5, 120);
      setPullDistance(damped);
    }
  };

  const onMouseUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (pullDistance >= 80) {
      doRefresh();
    } else {
      setPulling(false);
      setPullDistance(0);
    }
  };

  const handleCreatePost = () => {
    const content = postImageUrl
      ? `${newPostContent.trim()}\n\n[img:${postImageUrl}]`
      : newPostContent.trim();
    if (!content) return;
    createPost(userHandle, `@${userHandle.toLowerCase()}`, content, emojiMode, burnMode, selectedAvatar);
    setNewPostContent('');
    setEmojiMode(false);
    setBurnMode(false);
    setPostImageUrl(null);
    showToast('// POST PUBLISHED //');
  };

  const handleViewProfile = async (handle: string) => {
    if (handle === viewingProfile || handle === userHandle) return;
    const profile = await fetchUserProfile(handle);
    if (profile) {
      setProfileData({ handle: profile.handle, avatar: profile.avatar, createdAt: profile.created_at });
      setModalProfileUser(handle);
    }
  };

  const handleLike = (id: string) => { likePost(id, userHandle); showToast('// LIKED //'); };
  const handleDislike = (id: string) => { dislikePost(id, userHandle); showToast('// DISLIKED //'); };
  const handleShare = (id: string) => { sharePost(id); showToast('// SHARED //'); };
  const handleShareToFeed = (post: Post) => {
    const sharedContent = `// SHARED FROM @${post.author} //\n\n${post.content}`;
    createPost(displayName, displayName.toLowerCase(), sharedContent, !!post.emoji_encrypted, false)
      .then(() => { showToast('// SHARED TO YOUR FEED //'); fetchPosts(); })
      .catch(() => showToast('// SHARE FAILED //'));
  };
  const handleShareToRoom = (post: Post) => {
    setSelectedPostForShare(post);
    fetchChatRooms();
    setShowRoomPicker(true);
  };
  const doShareToRoom = async (roomId: string, roomName: string) => {
    if (!selectedPostForShare) return;
    const content = `// SHARED FROM @${selectedPostForShare.author} //\n\n${selectedPostForShare.content}`;
    try {
      if (roomId === 'general') {
        await sendOpenChatMessage(userHandle, content, false);
      } else {
        await sendRoomMessage(roomId, userHandle, content, false);
      }
      showToast(`// SHARED TO ${roomName} //`);
    } catch {
      showToast('// SHARE FAILED //');
    }
    setShowRoomPicker(false);
    setSelectedPostForShare(null);
  };
  const handleBurn = (id: string) => { deletePost(id); showToast('// BURNED //'); };

  const handleEdit = (post: Post) => {
    setEditingPost(post);
    setEditContent(post.content);
  };

  const handleSaveEdit = () => {
    if (!editingPost || !editContent.trim()) return;
    fetch(`${window.location.origin}/api/posts/${editingPost.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: editContent.trim(),
        emojiEncrypted: editingPost.emoji_encrypted === 1,
        burnAfter: editingPost.burn_after === 1,
      }),
    }).then(() => {
      fetchPosts();
      setEditingPost(null);
      showToast('// POST UPDATED //');
    });
  };

  // Display info
  const displayName = viewingProfile || userHandle || 'ANON';
  const isOwn = mode === 'own' && !viewingProfile;

  // Filter by type (encrypted/burned)
  const typeFilteredPosts = posts.filter(post => {
    if (filter === 'encrypted') return post.emoji_encrypted === 1;
    if (filter === 'burned') return post.burn_after === 1;
    return true;
  });

  // Filter by author based on mode — News shows ALL posts chronologically
  const filteredPosts = isOwn
    ? typeFilteredPosts.filter(post => post.author === userHandle)
    : viewingProfile
    ? typeFilteredPosts.filter(post => post.author === viewingProfile).sort((a, b) => b.timestamp - a.timestamp)
    : [...typeFilteredPosts].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="h-full flex flex-col" style={{ background: 'hsl(var(--background))' }}>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin min-h-0 relative"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
      {/* Pull-to-refresh indicator */}
      {pulling && (
        <div
          className="absolute left-0 right-0 z-20 flex items-center justify-center transition-all overflow-hidden"
          style={{
            top: 0,
            height: `${pullDistance}px`,
            background: pullDistance >= 80 ? 'hsl(var(--primary) / 0.08)' : 'transparent',
            borderBottom: pullDistance >= 80 ? '1px solid hsl(var(--primary) / 0.3)' : '1px solid transparent',
          }}
        >
          <div className="flex flex-col items-center gap-1">
            <div
              className="w-1 h-1 rounded-full transition-all"
              style={{
                background: pullDistance >= 80 ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                transform: `scale(${Math.min(1 + pullDistance / 60, 2.5)})`,
                opacity: Math.min(pullDistance / 40, 1),
              }}
            />
            <span
              className="font-mono text-[9px] uppercase tracking-widest transition-all"
              style={{
                color: pullDistance >= 80 ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                opacity: pullDistance >= 40 ? 1 : 0,
              }}
            >
              {refreshing ? '// SYNCING //' : pullDistance >= 80 ? '// RELEASE TO REFRESH //' : '// PULL //'}
            </span>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-md" style={{ background: 'hsl(var(--primary) / 0.12)', border: '1px solid hsl(var(--primary))' }}>
          <span className="font-mono text-xs" style={{ color: 'hsl(var(--foreground))' }}>{toast}</span>
        </div>
      )}

      {/* Edit Post Modal */}
      {editingPost && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center backdrop-blur-sm" style={{ background: 'hsl(var(--background) / 0.8)' }}>
          <div className="w-full max-w-sm mx-4 rounded-xl p-6" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-xl tracking-wider" style={{ color: 'hsl(var(--foreground))' }}>EDIT POST</h3>
              <button onClick={() => setEditingPost(null)} style={{ color: 'hsl(var(--muted-foreground))' }}>
                <X size={18} />
              </button>
            </div>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={4}
              className="w-full rounded-lg px-3 py-2 font-mono text-sm focus:outline-none resize-none mb-4"
              style={{ background: 'hsl(var(--input))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' }}
            />
            <button
              onClick={handleSaveEdit}
              disabled={!editContent.trim()}
              className="w-full py-3 font-mono text-xs uppercase tracking-wider rounded-md hover:brightness-110 disabled:opacity-30 transition-all"
              style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
            >
              Update Post
            </button>
          </div>
        </div>
      )}

      {/* Room Picker Modal */}
      {showRoomPicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center backdrop-blur-sm" style={{ background: 'hsl(var(--background) / 0.8)' }}>
          <div className="w-full max-w-sm mx-4 rounded-xl p-5" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-lg tracking-wider" style={{ color: 'hsl(var(--foreground))' }}>SHARE TO ROOM</h3>
              <button onClick={() => { setShowRoomPicker(false); setSelectedPostForShare(null); }} style={{ color: 'hsl(var(--muted-foreground))' }}>
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              <button
                onClick={() => doShareToRoom('general', 'THE LOUNGE')}
                className="w-full flex items-center gap-3 p-3 border rounded-lg text-left transition-all hover:brightness-110"
                style={{ borderColor: 'hsl(var(--primary) / 0.4)', background: 'hsl(var(--card))' }}
              >
                <Globe size={16} style={{ color: 'hsl(var(--primary))' }} />
                <div>
                  <span className="font-mono text-sm uppercase tracking-wider" style={{ color: 'hsl(var(--foreground))' }}>The Lounge</span>
                  <p className="font-mono text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>Public open chat</p>
                </div>
              </button>
              {chatRooms.map(room => (
                <button
                  key={room.id}
                  onClick={() => doShareToRoom(room.id, room.name)}
                  className="w-full flex items-center gap-3 p-3 border rounded-lg text-left transition-all hover:brightness-110"
                  style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--card))' }}
                >
                  <Hash size={16} style={{ color: 'hsl(var(--muted-foreground))' }} />
                  <div>
                    <span className="font-mono text-sm" style={{ color: 'hsl(var(--foreground))' }}>{room.name}</span>
                    <p className="font-mono text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>by {room.creator_handle}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* NEWS FEED HEADER (feed mode only, no viewingProfile) */}
      {!isOwn && !viewingProfile && (
        <div className="px-4 md:px-6 pt-4 md:pt-6 pb-4">
          <div className="flex items-center gap-3 mb-2">
            <Globe size={18} style={{ color: 'hsl(var(--primary))' }} />
            <h1 className="font-serif text-xl md:text-2xl tracking-wider" style={{ color: 'hsl(var(--foreground))' }}>NEWS</h1>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>// RECENT TRANSMISSIONS FROM THE NETWORK //</p>
        </div>
      )}

      {/* PROFILE HEADER — YOUR data normally, THEIR data when viewingProfile */}
      {(isOwn || viewingProfile) && (
      <div className="px-4 md:px-6 pt-4 md:pt-6 pb-4">
        <div className="flex items-start gap-4 md:gap-5">
          {isOwn ? (
            <button
              onClick={() => setShowAvatarPicker(!showAvatarPicker)}
              className="w-16 h-16 md:w-24 md:h-24 rounded-full flex-shrink-0 border-2 overflow-hidden relative group"
              style={{ borderColor: 'hsl(var(--primary) / 0.5)' }}
            >
              {selectedAvatar ? (
                <img src={selectedAvatar} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{ background: 'hsl(var(--primary))' }}>
                  <span className="font-serif text-2xl md:text-4xl font-bold text-white">{displayName.charAt(0)}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <UserCircle size={20} className="text-white" />
              </div>
            </button>
          ) : (
            <div className="w-16 h-16 md:w-24 md:h-24 rounded-full flex-shrink-0 border-2 overflow-hidden" style={{ borderColor: 'hsl(var(--primary) / 0.5)' }}>
              {userProfiles[viewingProfile!]?.avatar ? (
                <img src={userProfiles[viewingProfile!].avatar!} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center" style={{ background: 'hsl(var(--primary))' }}>
                  <span className="font-serif text-2xl md:text-4xl font-bold text-white">{viewingProfile!.charAt(0)}</span>
                </div>
              )}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-serif text-xl md:text-3xl tracking-wider mb-1" style={{ color: 'hsl(var(--foreground))' }}>{displayName}</h1>
            <p className="font-mono text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>@{displayName.toLowerCase()}</p>
            {viewingProfile && (
              <button
                onClick={() => setViewingProfile(null)}
                className="mt-2 px-3 py-1 font-mono text-[10px] uppercase tracking-wider border rounded-sm transition-all hover:brightness-110"
                style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}
              >
                BACK TO MY PROFILE
              </button>
            )}
          </div>
          {isOwn && (
            <div className="flex flex-col md:flex-row gap-2 flex-shrink-0">
              <button onClick={() => setShowEditProfile(true)} className="px-3 py-2 md:px-4 md:py-2.5 border font-mono text-xs uppercase tracking-wider hover:opacity-80 transition-all rounded-sm whitespace-nowrap" style={{ borderColor: 'hsl(var(--primary))', color: 'hsl(var(--primary))' }}>Edit Profile</button>
            </div>
          )}
        </div>
      </div>
      )}

      {/* AVATAR PICKER (own mode only) */}
      {isOwn && showAvatarPicker && (
        <div className="px-4 md:px-6 mb-4">
          <div className="p-4 border rounded-lg" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--card))' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-mono text-xs uppercase tracking-wider" style={{ color: 'hsl(var(--primary))' }}>Select Avatar</h3>
              {selectedAvatar && (
                <button
                  onClick={() => { setSelectedAvatar(null); setShowAvatarPicker(false); }}
                  className="font-mono text-[10px] uppercase px-2 py-1 rounded-sm transition-all"
                  style={{ border: '1px solid hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}
                >
                  Clear
                </button>
              )}
            </div>
            <div className="grid grid-cols-4 gap-3">
              {PRESET_AVATARS.map((avatar) => (
                <button
                  key={avatar.id}
                  onClick={() => { setSelectedAvatar(avatar.path); setShowAvatarPicker(false); }}
                  className="relative aspect-square rounded-full overflow-hidden border-2 transition-all hover:scale-105"
                  style={{
                    borderColor: selectedAvatar === avatar.path ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                  }}
                  title={avatar.name}
                >
                  <img
                    src={avatar.path}
                    alt={avatar.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {selectedAvatar === avatar.path && (
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <div className="w-3 h-3 rounded-full" style={{ background: 'hsl(var(--primary))' }} />
                    </div>
                  )}
                </button>
              ))}
            </div>
            <p className="font-mono text-[9px] mt-3 text-center" style={{ color: 'hsl(var(--muted-foreground))' }}>
              Tarot & Zodiac wood carvings — tap to select
            </p>
          </div>
        </div>
      )}

      {/* STATS (own mode only) */}
      {isOwn && (
      <div className="px-4 md:px-6 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-y" style={{ borderColor: 'hsl(var(--border))' }}>
          {[
            { label: 'Posts', value: posts.filter(p => p.is_burned === 0).length },
            { label: 'Followers', value: '0' },
            { label: 'Following', value: '0' },
            { label: 'Status', value: 'SECURE' },
          ].map((stat) => (
            <div key={stat.label} className="py-2.5 text-center border-r last:border-r-0" style={{ borderColor: 'hsl(var(--border))' }}>
              <p className="font-mono text-sm" style={{ color: stat.label === 'Status' ? 'hsl(var(--primary))' : 'hsl(var(--foreground))' }}>{stat.value}</p>
              <p className="font-mono text-[9px] uppercase tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* BIO (own mode only) */}
      {isOwn && (
      <div className="px-4 md:px-6 mb-4">
        <div className="p-4 border rounded-lg space-y-1.5" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--card))' }}>
          <p className="font-mono text-xs leading-relaxed break-words" style={{ color: 'hsl(var(--card-foreground))' }}>—</p>
        </div>
      </div>
      )}

      {/* QUICK STATS (own mode only) */}
      {isOwn && (
      <div className="px-4 md:px-6 mb-4">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Encrypted', value: 'ON', icon: Lock },
            { label: 'Operatives', value: '0', icon: Users },
            { label: 'Security', value: 'ON', icon: Shield },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="p-3 border rounded-lg text-center" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--card))' }}>
                <Icon size={14} className="mx-auto mb-1" style={{ color: 'hsl(var(--primary))' }} />
                <p className="font-mono text-sm" style={{ color: 'hsl(var(--foreground))' }}>{stat.value}</p>
                <p className="font-mono text-[9px] uppercase tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>{stat.label}</p>
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* NEW POST COMPOSER (own mode only) */}
      {isOwn && (
      <div className="px-4 md:px-6 mb-4">
        <div className="p-4 border rounded-lg" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--card))' }}>
          <div className="flex items-center gap-2 mb-2">
            <Globe size={12} style={{ color: 'hsl(var(--muted-foreground))' }} />
            <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>// NEW TRANSMISSION //</span>
          </div>
          <textarea
            value={newPostContent}
            onChange={(e) => setNewPostContent(e.target.value)}
            placeholder="Compose your message..."
            rows={2}
            className="w-full rounded-lg px-3 py-2 font-mono text-sm focus:outline-none resize-none transition-colors mb-3"
            style={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' }}
          />
          {postImageUrl && (
            <div className="mt-2 mb-2 relative">
              <img src={postImageUrl} alt="" className="w-full max-h-40 object-cover rounded-lg" style={{ border: '1px solid hsl(var(--border))' }} />
              <button
                onClick={() => setPostImageUrl(null)}
                className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white"
              >
                <X size={12} />
              </button>
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEmojiMode(!emojiMode)}
                className={`px-2 py-1 font-mono text-[10px] uppercase tracking-wider border rounded-sm transition-all ${emojiMode ? 'bg-blood/10' : ''}`}
                style={emojiMode ? { borderColor: 'hsl(var(--primary))', color: 'hsl(var(--primary))' } : { borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}
              >
                {emojiMode ? 'ENCRYPTED' : 'PLAIN'}
              </button>
              <button
                onClick={() => setBurnMode(!burnMode)}
                className={`px-2 py-1 font-mono text-[10px] uppercase tracking-wider border rounded-sm transition-all flex items-center gap-1 ${burnMode ? 'bg-blood/10' : ''}`}
                style={burnMode ? { borderColor: 'hsl(var(--primary))', color: 'hsl(var(--primary))' } : { borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}
              >
                <Flame size={10} />
                {burnMode ? 'BURN ON' : 'BURN OFF'}
              </button>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                id="post-image-upload"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setPostUploading(true);
                  const data = await uploadFile(file);
                  if (data && data.url) setPostImageUrl(data.url);
                  setPostUploading(false);
                }}
              />
              <label
                htmlFor="post-image-upload"
                className="px-2 py-1 font-mono text-[10px] uppercase tracking-wider border rounded-sm transition-all flex items-center gap-1 cursor-pointer"
                style={{ borderColor: postImageUrl ? 'hsl(var(--primary))' : 'hsl(var(--border))', color: postImageUrl ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }}
              >
                {postUploading ? '...' : postImageUrl ? 'IMG+' : 'IMG'}
              </label>
            </div>
            <button
              onClick={handleCreatePost}
              disabled={!newPostContent.trim()}
              className="px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider rounded-sm hover:brightness-110 disabled:opacity-30 transition-all flex items-center gap-1"
              style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
            >
              <Send size={10} />
              Publish
            </button>
          </div>
        </div>
      </div>
      )}

      {/* FILTERS */}
      <div className="px-4 md:px-6 mb-3">
        <div className="flex items-center gap-2">
          {(['all', 'encrypted', 'burned'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider border rounded-sm transition-all ${
                filter === f ? 'bg-blood/10' : ''
              }`}
              style={filter === f ? { borderColor: 'hsl(var(--primary))', color: 'hsl(var(--primary))' } : { borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}
            >
              {f === 'all' ? 'All' : f === 'encrypted' ? 'Encrypted' : 'Burn'}
            </button>
          ))}
        </div>
      </div>

      {/* POSTS FEED */}
      <div className="flex-1">
        {filteredPosts.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-mono text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>{isOwn ? '// NO POSTS //' : '// NO TRANSMISSIONS //'}</p>
            <p className="font-mono text-[10px] mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>{isOwn ? 'Start a transmission' : 'Check back later for updates'}</p>
          </div>
        ) : (
          filteredPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUser={userHandle}
              selectedAvatar={selectedAvatar}
              replies={replies[post.id] || []}
              onLike={handleLike}
              onDislike={handleDislike}
              onShare={handleShare}
              onShareToFeed={handleShareToFeed}
              onShareToRoom={handleShareToRoom}
              onBurn={handleBurn}
              onFetchReplies={fetchReplies}
              onCreateReply={(postId, content) => { createReply(postId, userHandle, content); showToast('// REPLIED //'); }}
              onEdit={handleEdit}
              onViewProfile={handleViewProfile}
              authorAvatar={userProfiles[post.author]?.avatar || null}
            />
          ))
        )}
      </div>

      {showEditProfile && (
        <EditProfileModal
          isOpen={showEditProfile}
          currentHandle={userHandle}
          onClose={() => setShowEditProfile(false)}
          onSave={(profile) => { editProfile(profile.handle); setShowEditProfile(false); }}
        />
      )}

      <UserProfileModal
        isOpen={!!modalProfileUser}
        onClose={() => setModalProfileUser(null)}
        user={profileData || { handle: modalProfileUser || '' }}
        onMessage={async (h) => {
          try {
            const conv = await createConversation(userHandle, h);
            await fetchConversations(userHandle);
            if (conv && conv.id) {
              setActiveConversation(String(conv.id));
            }
            setActiveTab('message');
            showToast(`// OPENING: ${h} //`);
          } catch { showToast('// FAILED TO OPEN CHAT //'); }
          setModalProfileUser(null);
        }}
        onAddContact={(h) => {
          const existing = JSON.parse(localStorage.getItem('omerta_contacts_v2') || '[]');
          if (!existing.includes(h)) {
            localStorage.setItem('omerta_contacts_v2', JSON.stringify([...existing, h]));
          }
          showToast(`// ADDED TO CONTACTS: ${h} //`);
          setModalProfileUser(null);
        }}
        onViewProfile={(h) => {
          setViewingProfile(h);
          setModalProfileUser(null);
        }}
      />
      </div>
    </div>
  );
}

function formatTime(timestamp: number) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}
