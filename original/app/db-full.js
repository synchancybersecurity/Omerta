import { readStore, writeStore } from "../aes.js";

const DB_PATH = "./omerta.json";

function loadDb() {
  const data = readStore(DB_PATH, { users: [], conversations: [], messages: [], openChatMessages: [], posts: [], smsMessages: [], userSettings: {}, escrows: [], chatRooms: [], roomMessages: [] });
  if (!data.smsMessages) data.smsMessages = [];
  if (!data.userSettings) data.userSettings = {};
  if (!data.escrows) data.escrows = [];
  if (!data.houseSettings) data.houseSettings = { holdingWallet: '', feeWallet: '', houseFeePercent: 2.25 };
  if (!data.chatRooms) data.chatRooms = [];
  if (!data.roomMessages) data.roomMessages = [];
  return data;
}

function saveDb(db) {
  writeStore(DB_PATH, db);
}

let db = loadDb();
if (!db.posts) db.posts = [];

for (const post of db.posts) {
  if (!post.replies) post.replies = [];
  if (!post.liked_by) post.liked_by = [];
  if (!post.disliked_by) post.disliked_by = [];
  if (!post.author_avatar) post.author_avatar = null;
}

// ===== USERS =====
export function createUser(handle, passphrase) {
  if (db.users.find(u => u.handle === handle)) return null;
  const user = { id: Date.now(), handle, passphrase, created_at: Math.floor(Date.now()/1000) };
  db.users.push(user); saveDb(db); return user;
}

export function verifyUser(handle, passphrase) {
  return db.users.find(u => u.handle === handle && u.passphrase === passphrase) || null;
}

// ===== CONVERSATIONS =====
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

// ===== MESSAGES =====
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

// ===== OPEN CHAT =====
export function sendOpenChatMessage(sender, content, emojiEncrypted = 0, replyTo = null, replyContent = null, replySender = null) {
  const msg = { id: Date.now(), sender_handle: sender, content, timestamp: Date.now(), emoji_encrypted: emojiEncrypted ? 1 : 0, reply_to: replyTo, reply_content: replyContent, reply_sender: replySender };
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

// ===== USERS SEARCH =====
export function searchUsers(query) {
  const q = query.toLowerCase();
  return db.users
    .filter(u => u.handle.toLowerCase().includes(q))
    .map(u => ({ id: u.id, handle: u.handle, created_at: u.created_at }))
    .slice(0, 20);
}

// ===== SMS =====
export function sendSMS(sender, recipient, content, burnAfterRead = 0) {
  const msg = { id: Date.now(), sender_handle: sender, recipient, content, timestamp: Date.now(), burn_after_read: burnAfterRead ? 1 : 0, is_burned: 0 };
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
  return { handle: user.handle, created_at: user.created_at, avatar: settings.avatar || null };
}

// ===== HOUSE ESCROW SETTINGS =====
export function getHouseSettings() {
  return db.houseSettings || { holdingWallet: '', feeWallet: '', houseFeePercent: 2.25 };
}

export function saveHouseSettings(settings) {
  db.houseSettings = { ...db.houseSettings, ...settings, updated_at: Date.now() };
  saveDb(db);
}

// ===== ESCROW =====
const ROOM_LIMITS = { admin: Infinity, moderator: 3, basic: 1 };

function countRoomsByCreator(creatorHandle) {
  return (db.chatRooms || []).filter(r => r.creator_handle === creatorHandle).length;
}

export function createEscrow(sender, recipient, amount, description) {
  if (!db.escrows) db.escrows = [];
  const houseFeePercent = db.houseSettings?.houseFeePercent || 2.25;
  const houseFee = Number((Number(amount) * (houseFeePercent / 100)).toFixed(2));
  const netAmount = Number((Number(amount) - houseFee).toFixed(2));
  const escrow = {
    id: 'e' + Date.now(),
    sender,
    recipient,
    amount: Number(amount),
    house_fee: houseFee,
    net_amount: netAmount,
    house_fee_percent: houseFeePercent,
    description: description || '',
    status: 'pending',
    created_at: Date.now(),
    resolved_at: null,
    resolved_by: null,
    resolution_note: null,
  };
  db.escrows.push(escrow); saveDb(db); return escrow;
}

export function getAllEscrows() {
  return (db.escrows || []).sort((a, b) => b.created_at - a.created_at);
}

export function getEscrowsForHandle(handle) {
  return (db.escrows || []).filter(e => e.sender === handle || e.recipient === handle).sort((a, b) => b.created_at - a.created_at);
}

export function updateEscrowStatus(id, status) {
  const escrow = (db.escrows || []).find(e => e.id === id);
  if (escrow) { escrow.status = status; saveDb(db); return escrow; }
  return null;
}

export function resolveEscrow(id, resolution, adminHandle, note) {
  const escrow = (db.escrows || []).find(e => e.id === id);
  if (!escrow) return null;
  escrow.status = resolution;
  escrow.resolved_at = Date.now();
  escrow.resolved_by = adminHandle;
  escrow.resolution_note = note || '';
  saveDb(db);
  return escrow;
}

// ===== POSTS =====
export function createPost(author, authorHandle, content, emojiEncrypted = 0, burnAfter = 0, authorAvatar = null) {
  const post = { id: 'p' + Date.now(), author, author_handle: authorHandle, author_avatar: authorAvatar, content, emoji_encrypted: emojiEncrypted ? 1 : 0, timestamp: Date.now(), likes: 0, dislikes: 0, comments: 0, shares: 0, is_burned: 0, burn_after: burnAfter ? 1 : 0, replies: [], liked_by: [], disliked_by: [] };
  db.posts.push(post); saveDb(db); return post;
}

export function getPosts() {
  return db.posts
    .filter(p => !p.is_burned)
    .map(p => ({ ...p, comments: (p.replies || []).length, likes: (p.liked_by || []).length, dislikes: (p.disliked_by || []).length }))
    .sort((a, b) => b.timestamp - a.timestamp);
}

export function deletePost(postId) {
  const post = db.posts.find(p => p.id === postId);
  if (post) { post.is_burned = 1; saveDb(db); return true; }
  return false;
}

export function updatePost(postId, updates) {
  const post = db.posts.find(p => p.id === postId);
  if (!post) return null;
  if (updates.content !== undefined) post.content = updates.content;
  if (updates.emojiEncrypted !== undefined) post.emoji_encrypted = updates.emojiEncrypted ? 1 : 0;
  if (updates.burnAfter !== undefined) post.burn_after = updates.burnAfter ? 1 : 0;
  saveDb(db);
  return post;
}

export function likePost(postId, userHandle) {
  const post = db.posts.find(p => p.id === postId);
  if (!post) return null;
  if (!post.liked_by) post.liked_by = [];
  if (!post.disliked_by) post.disliked_by = [];
  if (post.liked_by.includes(userHandle)) post.liked_by = post.liked_by.filter(h => h !== userHandle);
  else { post.liked_by.push(userHandle); post.disliked_by = post.disliked_by.filter(h => h !== userHandle); }
  saveDb(db);
  return { likes: post.liked_by.length, dislikes: post.disliked_by.length, liked_by: post.liked_by, disliked_by: post.disliked_by };
}

export function dislikePost(postId, userHandle) {
  const post = db.posts.find(p => p.id === postId);
  if (!post) return null;
  if (!post.liked_by) post.liked_by = [];
  if (!post.disliked_by) post.disliked_by = [];
  if (post.disliked_by.includes(userHandle)) post.disliked_by = post.disliked_by.filter(h => h !== userHandle);
  else { post.disliked_by.push(userHandle); post.liked_by = post.liked_by.filter(h => h !== userHandle); }
  saveDb(db);
  return { likes: post.liked_by.length, dislikes: post.disliked_by.length, liked_by: post.liked_by, disliked_by: post.disliked_by };
}

export function sharePost(postId) {
  const post = db.posts.find(p => p.id === postId);
  if (!post) return null;
  post.shares = (post.shares || 0) + 1;
  saveDb(db);
  return { shares: post.shares };
}

export function createReply(postId, author, content) {
  const post = db.posts.find(p => p.id === postId);
  if (!post) return null;
  if (!post.replies) post.replies = [];
  const reply = { id: 'r' + Date.now(), post_id: postId, author, content, timestamp: Date.now() };
  post.replies.push(reply);
  saveDb(db);
  return reply;
}

export function getRepliesForPost(postId) {
  const post = db.posts.find(p => p.id === postId);
  return post?.replies || [];
}

export function searchMessages(handle, query) {
  const q = query.toLowerCase();
  const results = [];
  const userConvos = (db.conversations || []).filter(c => c.user1_handle === handle || c.user2_handle === handle);
  for (const conv of userConvos) {
    const otherHandle = conv.user1_handle === handle ? conv.user2_handle : conv.user1_handle;
    const msgs = (db.messages || []).filter(m => m.conversation_id === conv.id && m.content.toLowerCase().includes(q));
    for (const msg of msgs) results.push({ ...msg, other_handle: otherHandle, conversation_id: conv.id });
  }
  const smsResults = (db.smsMessages || []).filter(m => (m.sender_handle === handle || m.recipient === handle) && m.content.toLowerCase().includes(q));
  for (const msg of smsResults) results.push({ ...msg, other_handle: msg.sender_handle === handle ? msg.recipient : msg.sender_handle, is_sms: true });
  return results.sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
}

// ===== CHAT ROOMS =====
export function createChatRoom(name, creatorHandle, role, isLocked, password) {
  if (!db.chatRooms) db.chatRooms = [];
  const limit = ROOM_LIMITS[role] || ROOM_LIMITS.basic;
  const count = countRoomsByCreator(creatorHandle);
  if (count >= limit) return null;
  const room = {
    id: 'room-' + Date.now(),
    name: name || 'Untitled Room',
    creator_handle: creatorHandle,
    creator_role: role,
    is_locked: isLocked ? 1 : 0,
    password: password || null,
    locked_by: null,
    lock_reason: null,
    created_at: Date.now(),
  };
  db.chatRooms.push(room);
  saveDb(db);
  return room;
}

export function getChatRooms() {
  return (db.chatRooms || []).sort((a, b) => b.created_at - a.created_at);
}

export function getChatRoomById(roomId) {
  return (db.chatRooms || []).find(r => r.id === roomId) || null;
}

export function getChatRoomByCreator(creatorHandle) {
  return (db.chatRooms || []).find(r => r.creator_handle === creatorHandle) || null;
}

export function deleteChatRoom(roomId) {
  const idx = (db.chatRooms || []).findIndex(r => r.id === roomId);
  if (idx !== -1) {
    db.chatRooms.splice(idx, 1);
    if (db.roomMessages) db.roomMessages = db.roomMessages.filter(m => m.room_id !== roomId);
    saveDb(db);
    return true;
  }
  return false;
}

export function lockChatRoom(roomId, lockedBy, reason) {
  const room = getChatRoomById(roomId);
  if (!room) return null;
  room.is_locked = 1;
  room.locked_by = lockedBy;
  room.lock_reason = reason || 'Locked by ' + lockedBy;
  saveDb(db);
  return room;
}

export function unlockChatRoom(roomId) {
  const room = getChatRoomById(roomId);
  if (!room) return null;
  room.is_locked = 0;
  room.locked_by = null;
  room.lock_reason = null;
  saveDb(db);
  return room;
}

export function canBypassLock(roomId, userRole) {
  const room = getChatRoomById(roomId);
  if (!room) return false;
  if (!room.is_locked) return true;
  if (userRole === 'admin') return true;
  if (userRole === 'moderator' && room.creator_role !== 'moderator' && room.creator_role !== 'admin') return true;
  return false;
}

export function verifyRoomPassword(roomId, password) {
  const room = getChatRoomById(roomId);
  if (!room) return false;
  if (!room.is_locked) return true;
  return room.password === password;
}

export function sendRoomMessage(roomId, sender, content, emojiEncrypted, replyTo, replyContent, replySender) {
  if (!db.roomMessages) db.roomMessages = [];
  const msg = {
    id: Date.now(),
    room_id: roomId,
    sender_handle: sender,
    content: content,
    timestamp: Date.now(),
    emoji_encrypted: emojiEncrypted ? 1 : 0,
    reply_to: replyTo || null,
    reply_content: replyContent || null,
    reply_sender: replySender || null,
  };
  db.roomMessages.push(msg);
  saveDb(db);
  return msg;
}

export function getRoomMessages(roomId) {
  return (db.roomMessages || [])
    .filter(m => m.room_id === roomId)
    .sort((a, b) => a.timestamp - b.timestamp);
}
