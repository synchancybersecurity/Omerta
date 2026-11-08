import { readFileSync, writeFileSync, existsSync } from 'fs';

const DB_PATH = './omerta.json';

function loadDb() {
  if (!existsSync(DB_PATH)) return { users: [], conversations: [], messages: [], openChatMessages: [], posts: [], smsMessages: [], userSettings: {}, escrows: [] };
  const data = JSON.parse(readFileSync(DB_PATH, 'utf8'));
  if (!data.smsMessages) data.smsMessages = [];
  if (!data.userSettings) data.userSettings = {};
  if (!data.escrows) data.escrows = [];
  return data;
}

function saveDb(db) {
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

let db = loadDb();
if (!db.posts) db.posts = [];

// Migrate old posts
for (const post of db.posts) {
  if (!post.replies) post.replies = [];
  if (!post.liked_by) post.liked_by = [];
  if (!post.disliked_by) post.disliked_by = [];
  if (!post.author_avatar) post.author_avatar = null;
}

export function createUser(handle, passphrase) {
  if (db.users.find(u => u.handle === handle)) return null;
  const user = { id: Date.now(), handle, passphrase, created_at: Math.floor(Date.now()/1000) };
  db.users.push(user); saveDb(db); return user;
}

export function verifyUser(handle, passphrase) {
  return db.users.find(u => u.handle === handle && u.passphrase === passphrase) || null;
}

export function getOrCreateConversation(user1, user2) {
  const [a, b] = [user1, user2].sort();
  let conv = db.conversations.find(c => c.user1_handle === a && c.user2_handle === b);
  if (!conv) {
    conv = { id: Date.now(), user1_handle: a, user2_handle: b, created_at: Math.floor(Date.now()/1000) };
    db.conversations.push(conv); saveDb(db);
  }
  return conv;
}

export function getConversationsForUser(handle) {
  return db.conversations
    .filter(c => c.user1_handle === handle || c.user2_handle === handle)
    .map(c => {
      const msgs = db.messages.filter(m => m.conversation_id === c.id).sort((a,b) => a.timestamp - b.timestamp);
      const last = msgs[msgs.length - 1];
      return { ...c, last_message: last?.content || null, last_timestamp: last?.timestamp || null, unread: msgs.filter(m => m.sender_handle !== handle && !m.is_burned).length };
    })
    .sort((a, b) => (b.last_timestamp || 0) - (a.last_timestamp || 0));
}

export function sendMessage(conversationId, sender, content, burnAfterRead = 0, emojiEncrypted = 0, replyTo = null, replyContent = null, replySender = null) {
  const msg = { id: Date.now(), conversation_id: Number(conversationId), sender_handle: sender, content, timestamp: Date.now(), burn_after_read: burnAfterRead ? 1 : 0, is_burned: 0, emoji_encrypted: emojiEncrypted ? 1 : 0, reply_to: replyTo, reply_content: replyContent, reply_sender: replySender };
  db.messages.push(msg); saveDb(db); return msg;
}

export function getMessagesForConversation(conversationId) {
  return db.messages.filter(m => m.conversation_id === Number(conversationId)).sort((a,b) => a.timestamp - b.timestamp);
}

export function burnMessage(messageId) {
  const msg = db.messages.find(m => m.id === Number(messageId));
  if (msg) { msg.is_burned = 1; msg.content = '// BURNED //'; saveDb(db); }
}

export function editMessage(messageId, newContent) {
  const msg = db.messages.find(m => m.id === Number(messageId));
  if (msg) { msg.content = newContent; msg.edited = 1; saveDb(db); return msg; }
  return null;
}

export function deleteMessage(messageId) {
  const msg = db.messages.find(m => m.id === Number(messageId));
  if (msg) { msg.deleted = 1; msg.content = '// DELETED //'; saveDb(db); return msg; }
  return null;
}

export function replyToMessage(conversationId, sender, content, replyToId, emojiEncrypted = 0) {
  const msg = { id: Date.now(), conversation_id: Number(conversationId), sender_handle: sender, content, timestamp: Date.now(), burn_after_read: 0, is_burned: 0, emoji_encrypted: emojiEncrypted ? 1 : 0, reply_to: Number(replyToId) };
  db.messages.push(msg); saveDb(db); return msg;
}

export function sendOpenChatMessage(sender, content, emojiEncrypted = 0) {
  const msg = { id: Date.now(), sender_handle: sender, content, timestamp: Date.now(), emoji_encrypted: emojiEncrypted ? 1 : 0 };
  db.openChatMessages.push(msg); saveDb(db); return msg;
}

export function getOpenChatMessages() {
  return db.openChatMessages.slice(-100);
}

export function editOpenChatMessage(messageId, newContent) {
  const msg = db.openChatMessages.find(m => m.id === Number(messageId));
  if (msg) { msg.content = newContent; msg.edited = 1; saveDb(db); return msg; }
  return null;
}

export function deleteOpenChatMessage(messageId) {
  const msg = db.openChatMessages.find(m => m.id === Number(messageId));
  if (msg) { msg.deleted = 1; msg.content = '// DELETED //'; saveDb(db); return msg; }
  return null;
}

export function clearOpenChatMessages() {
  const count = db.openChatMessages.length;
  db.openChatMessages = [];
  saveDb(db);
  return { success: true, count };
}

// ===== USER SEARCH =====
export function searchUsers(query) {
  const q = query.toLowerCase();
  return db.users
    .filter(u => u.handle.toLowerCase().includes(q))
    .map(u => ({ id: u.id, handle: u.handle, created_at: u.created_at }))
    .slice(0, 20);
}

// ===== SMS =====
export function sendSMS(sender, recipient, content, burnAfterRead = 0) {
  const msg = {
    id: Date.now(),
    sender_handle: sender,
    recipient,
    content,
    timestamp: Date.now(),
    burn_after_read: burnAfterRead ? 1 : 0,
    is_burned: 0,
  };
  db.smsMessages.push(msg);
  saveDb(db);
  return msg;
}

export function getSMS(handle) {
  return db.smsMessages
    .filter(m => m.sender_handle === handle || m.recipient === handle)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 200);
}

export function burnSMS(messageId) {
  const msg = db.smsMessages.find(m => m.id === Number(messageId));
  if (msg) { msg.is_burned = 1; msg.content = '// BURNED //'; saveDb(db); }
}

// ===== USER SETTINGS =====
export function saveUserSettings(handle, settings) {
  if (!db.userSettings) db.userSettings = {};
  db.userSettings[handle] = { ...db.userSettings[handle], ...settings, updated_at: Date.now() };
  saveDb(db);
}

export function getUserSettings(handle) {
  return db.userSettings?.[handle] || null;
}

export function getUserProfile(handle) {
  const user = db.users.find(u => u.handle === handle);
  if (!user) return null;
  const settings = db.userSettings?.[handle] || {};
  return {
    handle: user.handle,
    created_at: user.created_at,
    avatar: settings.avatar || null,
  };
}

// ===== ESCROW =====
export function createEscrow(sender, recipient, amount, description) {
  if (!db.escrows) db.escrows = [];
  const escrow = { id: 'e' + Date.now(), sender, recipient, amount: Number(amount), description: description || '', status: 'pending', created_at: Date.now() };
  db.escrows.push(escrow); saveDb(db); return escrow;
}

export function getEscrowsForHandle(handle) {
  return (db.escrows || []).filter(e => e.sender === handle || e.recipient === handle).sort((a, b) => b.created_at - a.created_at);
}

export function updateEscrowStatus(id, status) {
  const escrow = (db.escrows || []).find(e => e.id === id);
  if (escrow) { escrow.status = status; saveDb(db); return escrow; }
  return null;
}

// ===== SEARCH MESSAGES =====
export function searchMessages(handle, query) {
  const q = query.toLowerCase();
  const results = [];
  const userConvos = (db.conversations || []).filter(c => c.user1_handle === handle || c.user2_handle === handle);
  for (const conv of userConvos) {
    const otherHandle = conv.user1_handle === handle ? conv.user2_handle : conv.user1_handle;
    const msgs = (db.messages || []).filter(m => m.conversation_id === conv.id && m.content.toLowerCase().includes(q));
    for (const msg of msgs) {
      results.push({ ...msg, other_handle: otherHandle, conversation_id: conv.id });
    }
  }
  // Also search SMS
  const smsResults = (db.smsMessages || []).filter(m => (m.sender_handle === handle || m.recipient === handle) && m.content.toLowerCase().includes(q));
  for (const msg of smsResults) {
    results.push({ ...msg, is_sms: true });
  }
  return results.sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
}

// ===== POSTS =====
export function createPost(author, authorHandle, content, emojiEncrypted = 0, burnAfter = 0, authorAvatar = null) {
  const post = {
    id: 'p' + Date.now(),
    author,
    author_handle: authorHandle,
    author_avatar: authorAvatar,
    content,
    emoji_encrypted: emojiEncrypted ? 1 : 0,
    timestamp: Date.now(),
    likes: 0,
    dislikes: 0,
    comments: 0,
    shares: 0,
    is_burned: 0,
    burn_after: burnAfter ? 1 : 0,
    replies: [],
    liked_by: [],
    disliked_by: []
  };
  db.posts.push(post);
  saveDb(db);
  return post;
}

export function getPosts() {
  return db.posts
    .filter(p => !p.is_burned)
    .map(p => ({
      ...p,
      comments: (p.replies || []).length,
      likes: (p.liked_by || []).length,
      dislikes: (p.disliked_by || []).length
    }))
    .sort((a, b) => b.timestamp - a.timestamp);
}

export function deletePost(postId) {
  const post = db.posts.find(p => p.id === postId);
  if (post) { post.is_burned = 1; saveDb(db); return true; }
  return false;
}

export function updatePost(postId, updates) {
  const post = db.posts.find(p => p.id === postId);
  if (post) {
    if (updates.content !== undefined) post.content = updates.content;
    if (updates.emoji_encrypted !== undefined) post.emoji_encrypted = updates.emoji_encrypted ? 1 : 0;
    if (updates.burn_after !== undefined) post.burn_after = updates.burn_after ? 1 : 0;
    saveDb(db);
    return post;
  }
  return null;
}

export function sharePost(postId) {
  const post = db.posts.find(p => p.id === postId);
  if (post) { post.shares = (post.shares || 0) + 1; saveDb(db); return post; }
  return null;
}

// ===== LIKE / DISLIKE (toggle, one per person) =====
export function likePost(postId, userHandle) {
  const post = db.posts.find(p => p.id === postId);
  if (!post) return null;
  if (!post.liked_by) post.liked_by = [];
  if (!post.disliked_by) post.disliked_by = [];

  const alreadyLiked = post.liked_by.includes(userHandle);
  const alreadyDisliked = post.disliked_by.includes(userHandle);

  if (alreadyLiked) {
    // Toggle off: remove like
    post.liked_by = post.liked_by.filter(h => h !== userHandle);
  } else {
    // Add like, remove dislike if present
    post.liked_by.push(userHandle);
    if (alreadyDisliked) {
      post.disliked_by = post.disliked_by.filter(h => h !== userHandle);
    }
  }

  post.likes = post.liked_by.length;
  post.dislikes = post.disliked_by.length;
  saveDb(db);
  return { ...post, likes: post.likes, dislikes: post.dislikes, liked_by: post.liked_by, disliked_by: post.disliked_by };
}

export function dislikePost(postId, userHandle) {
  const post = db.posts.find(p => p.id === postId);
  if (!post) return null;
  if (!post.liked_by) post.liked_by = [];
  if (!post.disliked_by) post.disliked_by = [];

  const alreadyLiked = post.liked_by.includes(userHandle);
  const alreadyDisliked = post.disliked_by.includes(userHandle);

  if (alreadyDisliked) {
    // Toggle off: remove dislike
    post.disliked_by = post.disliked_by.filter(h => h !== userHandle);
  } else {
    // Add dislike, remove like if present
    post.disliked_by.push(userHandle);
    if (alreadyLiked) {
      post.liked_by = post.liked_by.filter(h => h !== userHandle);
    }
  }

  post.likes = post.liked_by.length;
  post.dislikes = post.disliked_by.length;
  saveDb(db);
  return { ...post, likes: post.likes, dislikes: post.dislikes, liked_by: post.liked_by, disliked_by: post.disliked_by };
}

// ===== REPLIES =====
export function createReply(postId, author, content) {
  const post = db.posts.find(p => p.id === postId);
  if (!post) return null;
  const reply = {
    id: 'r' + Date.now(),
    post_id: postId,
    author,
    content,
    timestamp: Date.now()
  };
  if (!post.replies) post.replies = [];
  post.replies.push(reply);
  post.comments = post.replies.length;
  saveDb(db);
  return reply;
}

export function getRepliesForPost(postId) {
  const post = db.posts.find(p => p.id === postId);
  return post?.replies || [];
}
