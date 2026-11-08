import 'dotenv/config';
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import * as db from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 7777;
const NODE_ENV = process.env.NODE_ENV || 'development';
const UPLOAD_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({ dest: UPLOAD_DIR });

// Middleware
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'] }));
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));

// Static SPA files
app.use(express.static(path.join(__dirname, 'dist')));

// Health
app.get('/health', (req, res) => {
  res.json({ status: 'ok', env: NODE_ENV, timestamp: Date.now() });
});

// ===== AUTH =====
app.post('/api/auth/register', (req, res) => {
  const { handle, passphrase } = req.body;
  if (!handle || !passphrase) return res.status(400).json({ error: 'Missing fields' });
  const user = db.createUser(handle, passphrase);
  if (!user) return res.status(409).json({ error: 'Handle already exists' });
  res.json({ success: true, handle: user.handle, role: user.role });
});

app.post('/api/auth/login', (req, res) => {
  const { handle, passphrase } = req.body;
  if (!handle || !passphrase) return res.status(400).json({ error: 'Missing fields' });
  const user = db.verifyUser(handle, passphrase);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  res.json({ success: true, handle: user.handle, role: user.role || 'basic' });
});

// ===== USERS =====
app.get('/api/users', (req, res) => {
  res.json(db.getAllUsers());
});

app.get('/api/users/search', (req, res) => {
  const q = req.query.q;
  if (!q) return res.json([]);
  res.json(db.searchUsers(q));
});

app.get('/api/users/:handle/profile', (req, res) => {
  const profile = db.getUserProfile(req.params.handle);
  if (!profile) return res.status(404).json({ error: 'Not found' });
  res.json(profile);
});

app.post('/api/users/:handle/promote', (req, res) => {
  const { role, adminHandle } = req.body;
  if (!role || !['basic', 'moderator', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  const admin = db.verifyUser(adminHandle, '');
  // We don't have password in request, so check role directly from DB
  const adminUser = db.getUserRole(adminHandle);
  if (adminUser !== 'admin') return res.status(403).json({ error: 'Admin only' });

  const user = db.promoteUser(req.params.handle, role);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ success: true, handle: user.handle, role: user.role });
});

// ===== SETTINGS =====
app.get('/api/settings/:handle', (req, res) => {
  const settings = db.getUserSettings(req.params.handle);
  res.json(settings || {});
});

app.post('/api/settings/:handle', (req, res) => {
  db.saveUserSettings(req.params.handle, req.body);
  res.json({ success: true });
});

// ===== CONVERSATIONS / PRIVATE MESSAGES =====
app.get('/api/conversations', (req, res) => {
  const handle = req.query.handle;
  if (!handle) return res.status(400).json({ error: 'Missing handle' });
  res.json(db.getConversationsForUser(handle));
});

app.post('/api/conversations', (req, res) => {
  const { user1, user2 } = req.body;
  if (!user1 || !user2) return res.status(400).json({ error: 'Missing fields' });
  const conv = db.getOrCreateConversation(user1, user2);
  res.json(conv);
});

app.get('/api/conversations/:id/messages', (req, res) => {
  res.json(db.getMessagesForConversation(req.params.id));
});

app.post('/api/conversations/:id/messages', (req, res) => {
  const { sender, content, burnAfterRead, emojiEncrypted, e2eEncrypted, replyTo, replyContent, replySender } = req.body;
  if (!sender || !content) return res.status(400).json({ error: 'Missing fields' });
  const msg = db.sendMessage(req.params.id, sender, content, burnAfterRead, emojiEncrypted, e2eEncrypted, replyTo, replyContent, replySender);
  broadcast({ type: 'private_message', conversationId: req.params.id, message: msg });
  res.json(msg);
});

// ===== MESSAGE BURN =====
app.post('/api/messages/:id/burn', (req, res) => {
  db.burnMessage(req.params.id);
  broadcast({ type: 'message_burned', messageId: req.params.id });
  res.json({ success: true });
});

// ===== OPEN CHAT =====
app.get('/api/open-chat', (req, res) => {
  res.json(db.getOpenChatMessages());
});

app.post('/api/open-chat', (req, res) => {
  const { sender, content, emojiEncrypted, e2eEncrypted, replyTo, replyContent, replySender } = req.body;
  if (!sender || !content) return res.status(400).json({ error: 'Missing fields' });
  const msg = db.sendOpenChatMessage(sender, content, emojiEncrypted, e2eEncrypted, replyTo, replyContent, replySender);
  broadcast({ type: 'open_chat', message: msg });
  res.json(msg);
});

app.delete('/api/open-chat/clear', (req, res) => {
  const result = db.clearOpenChatMessages();
  broadcast({ type: 'open_chat_cleared' });
  res.json(result);
});

// ===== SMS =====
app.get('/api/sms', (req, res) => {
  const handle = req.query.handle;
  if (!handle) return res.status(400).json({ error: 'Missing handle' });
  res.json(db.getSMS(handle));
});

app.post('/api/sms', (req, res) => {
  const { sender, recipient, content, burnAfterRead } = req.body;
  if (!sender || !recipient || !content) return res.status(400).json({ error: 'Missing fields' });
  const msg = db.sendSMS(sender, recipient, content, burnAfterRead);
  broadcast({ type: 'sms', message: msg });
  res.json(msg);
});

app.post('/api/sms/:id/burn', (req, res) => {
  db.burnSMS(req.params.id);
  broadcast({ type: 'sms_burned', messageId: req.params.id });
  res.json({ success: true });
});

// ===== FILE UPLOAD =====
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const url = `/uploads/${req.file.filename}`;
  res.json({ url });
});

// ===== ESCROW =====
app.get('/api/escrow', (req, res) => {
  const handle = req.query.handle;
  if (!handle) return res.status(400).json({ error: 'Missing handle' });
  res.json(db.getEscrowsForHandle(handle));
});

app.get('/api/escrow/all', (req, res) => {
  res.json(db.getAllEscrows());
});

app.post('/api/escrow', (req, res) => {
  const { sender, recipient, amount, description } = req.body;
  if (!sender || !recipient || !amount) return res.status(400).json({ error: 'Missing fields' });
  const escrow = db.createEscrow(sender, recipient, amount, description);
  broadcast({ type: 'escrow_created', escrow });
  res.json(escrow);
});

app.post('/api/escrow/:id/:action', (req, res) => {
  const { id, action } = req.params;
  if (!['release', 'dispute', 'cancel'].includes(action)) return res.status(400).json({ error: 'Invalid action' });
  const statusMap = { release: 'released', dispute: 'disputed', cancel: 'cancelled' };
  const escrow = db.updateEscrowStatus(id, statusMap[action]);
  if (!escrow) return res.status(404).json({ error: 'Not found' });
  broadcast({ type: 'escrow_updated', escrow });
  res.json(escrow);
});

app.post('/api/escrow/:id/resolve', (req, res) => {
  const { id } = req.params;
  const { resolution, adminHandle, note } = req.body;
  const escrow = db.resolveEscrow(id, resolution, adminHandle, note);
  if (!escrow) return res.status(404).json({ error: 'Not found' });
  broadcast({ type: 'escrow_updated', escrow });
  res.json(escrow);
});

// ===== HOUSE SETTINGS =====
app.get('/api/house/settings', (req, res) => {
  res.json(db.getHouseSettings());
});

app.post('/api/house/settings', (req, res) => {
  db.saveHouseSettings(req.body);
  res.json({ success: true });
});

// ===== SEARCH =====
app.get('/api/search/messages', (req, res) => {
  const { handle, q } = req.query;
  if (!handle || !q) return res.status(400).json({ error: 'Missing params' });
  res.json(db.searchMessages(handle, q));
});

// ===== CHAT ROOMS =====
app.get('/api/chat-rooms', (req, res) => {
  res.json(db.getChatRooms());
});

app.post('/api/chat-rooms', (req, res) => {
  const { name, creatorHandle, role, isLocked, password } = req.body;
  if (!name || !creatorHandle) return res.status(400).json({ error: 'Missing fields' });
  const room = db.createChatRoom(name, creatorHandle, role || 'basic', isLocked, password);
  if (!room) return res.status(403).json({ error: 'Room limit reached for your role' });
  broadcast({ type: 'chat_room_created', room });
  res.json(room);
});

app.delete('/api/chat-rooms/:id', (req, res) => {
  const ok = db.deleteChatRoom(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  broadcast({ type: 'chat_room_deleted', roomId: req.params.id });
  res.json({ success: true });
});

app.post('/api/chat-rooms/:id/lock', (req, res) => {
  const { lockedBy, reason } = req.body;
  const room = db.lockChatRoom(req.params.id, lockedBy, reason);
  if (!room) return res.status(404).json({ error: 'Not found' });
  broadcast({ type: 'chat_room_updated', room });
  res.json(room);
});

app.post('/api/chat-rooms/:id/unlock', (req, res) => {
  const room = db.unlockChatRoom(req.params.id);
  if (!room) return res.status(404).json({ error: 'Not found' });
  broadcast({ type: 'chat_room_updated', room });
  res.json(room);
});

app.get('/api/chat-rooms/:id/messages', (req, res) => {
  res.json(db.getRoomMessages(req.params.id));
});

app.post('/api/chat-rooms/:id/messages', (req, res) => {
  const { sender, content, emojiEncrypted, e2eEncrypted, replyTo, replyContent, replySender } = req.body;
  if (!sender || !content) return res.status(400).json({ error: 'Missing fields' });
  const msg = db.sendRoomMessage(req.params.id, sender, content, emojiEncrypted, e2eEncrypted, replyTo, replyContent, replySender);
  broadcast({ type: 'room_message', roomId: req.params.id, message: msg });
  res.json(msg);
});

// ===== POSTS =====
app.get('/api/posts', (req, res) => {
  res.json(db.getPosts());
});

app.post('/api/posts', (req, res) => {
  const { author, authorHandle, content, emojiEncrypted, burnAfter, authorAvatar } = req.body;
  if (!author || !content) return res.status(400).json({ error: 'Missing fields' });
  const post = db.createPost(author, authorHandle, content, emojiEncrypted, burnAfter, authorAvatar);
  broadcast({ type: 'new_post', post });
  res.json(post);
});

app.delete('/api/posts/:id', (req, res) => {
  const ok = db.deletePost(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  broadcast({ type: 'post_deleted', postId: req.params.id });
  res.json({ success: true });
});

app.post('/api/posts/:id/like', (req, res) => {
  const { userHandle } = req.body;
  const result = db.likePost(req.params.id, userHandle);
  if (!result) return res.status(404).json({ error: 'Not found' });
  broadcast({ type: 'post_liked', postId: req.params.id, ...result });
  res.json(result);
});

app.post('/api/posts/:id/dislike', (req, res) => {
  const { userHandle } = req.body;
  const result = db.dislikePost(req.params.id, userHandle);
  if (!result) return res.status(404).json({ error: 'Not found' });
  broadcast({ type: 'post_disliked', postId: req.params.id, ...result });
  res.json(result);
});

app.post('/api/posts/:id/share', (req, res) => {
  const result = db.sharePost(req.params.id);
  if (!result) return res.status(404).json({ error: 'Not found' });
  broadcast({ type: 'post_shared', postId: req.params.id, ...result });
  res.json(result);
});

app.get('/api/posts/:id/replies', (req, res) => {
  res.json(db.getRepliesForPost(req.params.id));
});

app.post('/api/posts/:id/replies', (req, res) => {
  const { author, content } = req.body;
  if (!author || !content) return res.status(400).json({ error: 'Missing fields' });
  const reply = db.createReply(req.params.id, author, content);
  if (!reply) return res.status(404).json({ error: 'Post not found' });
  broadcast({ type: 'new_reply', postId: req.params.id, reply });
  res.json(reply);
});

// ===== SYN TERMINAL =====
app.post('/api/syn/exec', (req, res) => {
  const { command } = req.body;
  if (!command) return res.status(400).json({ error: 'No command' });
  const allowed = /^[a-zA-Z0-9_\-\s\.\/,\*\?\|\&\;\'\"\$\=\(\)\[\]\{\}\!\@\#\%\+\~\`\^\<\>]+$/;
  if (!allowed.test(command)) {
    return res.status(400).json({ error: 'Invalid characters in command' });
  }
  const dangerous = /(rm\s+-rf\s*\/|\>;\s*mkfs|\dd\s+if=.*of=\/dev|\:(){\s*:\|:&};:)\s*$/i;
  if (dangerous.test(command)) {
    return res.status(403).json({ error: 'Dangerous command blocked' });
  }
  exec(command, { timeout: 30000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
    if (error) return res.json({ output: stdout, error: stderr || error.message });
    res.json({ output: stdout, error: stderr || null });
  });
});

// ===== E2E ENCRYPTION =====
const userPublicKeys = new Map(); // handle -> base64 publicKey JWK

app.post('/api/keys/register', (req, res) => {
  const { handle, publicKey } = req.body;
  if (!handle || !publicKey) return res.status(400).json({ error: 'Missing fields' });
  userPublicKeys.set(handle, publicKey);
  res.json({ success: true });
});

app.get('/api/keys/:handle', (req, res) => {
  const key = userPublicKeys.get(req.params.handle);
  if (!key) return res.status(404).json({ error: 'Key not found' });
  res.json({ handle: req.params.handle, publicKey: key });
});

app.post('/api/encrypted/send', (req, res) => {
  const { sender, recipient, payload } = req.body;
  if (!sender || !recipient || !payload) return res.status(400).json({ error: 'Missing fields' });
  const msg = {
    id: Date.now(),
    sender,
    recipient,
    iv: payload.iv,
    ciphertext: payload.ciphertext,
    senderPublicKey: payload.senderPublicKey,
    timestamp: Date.now(),
  };
  broadcast({ type: 'encrypted', sender, recipient, payload });
  res.json({ success: true, id: msg.id });
});

// ===== WEBSOCKET BROADCAST =====
function broadcast(data) {
  const payload = JSON.stringify(data);
  wss.clients.forEach(ws => {
    if (ws.readyState === 1) ws.send(payload);
  });
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'connected', time: Date.now() }));
});

// ===== SPA FALLBACK =====
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`Omerta Server running on port ${PORT} (${NODE_ENV})`);
});
