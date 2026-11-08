import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import multer from 'multer';
import {
  createUser, verifyUser, getOrCreateConversation, getConversationsForUser,
  sendMessage, getMessagesForConversation, burnMessage, editMessage, deleteMessage, replyToMessage,
  sendOpenChatMessage, getOpenChatMessages, editOpenChatMessage, deleteOpenChatMessage, clearOpenChatMessages,
  createPost, getPosts, deletePost, sharePost, updatePost,
  likePost, dislikePost,
  createReply, getRepliesForPost,
  searchUsers,
  sendSMS, getSMS, burnSMS,
  saveUserSettings, getUserSettings,
  createEscrow, getEscrowsForHandle, updateEscrowStatus,
  searchMessages, getUserProfile
} from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const clients = new Set();
function broadcast(data) {
  const msg = JSON.stringify(data);
  clients.forEach(ws => { if (ws.readyState === 1) ws.send(msg); });
}

// Multer file upload config
const upload = multer({
  dest: path.join(__dirname, 'uploads'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

import { mkdirSync, existsSync } from 'fs';
import { exec } from 'child_process';

// Ensure uploads dir exists
if (!existsSync(path.join(__dirname, 'uploads'))) {
  mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });
}

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

// ===== AUTH =====
app.post('/api/auth/register', (req, res) => {
  const { handle, passphrase } = req.body;
  if (!handle || !passphrase) return res.status(400).json({ error: 'Missing credentials' });
  const user = createUser(handle, passphrase);
  if (!user) return res.status(409).json({ error: 'Handle already exists' });
  res.json({ success: true, handle: user.handle });
});

app.post('/api/auth/login', (req, res) => {
  const { handle, passphrase } = req.body;
  if (!handle || !passphrase) return res.status(400).json({ error: 'Missing credentials' });
  const user = verifyUser(handle, passphrase);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  res.json({ success: true, handle: user.handle });
});

// ===== CONVERSATIONS =====
app.get('/api/conversations', (req, res) => {
  const { handle } = req.query;
  if (!handle) return res.status(400).json({ error: 'Missing handle' });
  res.json(getConversationsForUser(handle));
});

app.post('/api/conversations', (req, res) => {
  const { user1, user2 } = req.body;
  if (!user1 || !user2) return res.status(400).json({ error: 'Missing participants' });
  res.json(getOrCreateConversation(user1, user2));
});

app.get('/api/conversations/:id/messages', (req, res) => {
  res.json(getMessagesForConversation(req.params.id));
});

app.post('/api/conversations/:id/messages', (req, res) => {
  const { sender, content, burnAfterRead, emojiEncrypted, replyTo, replyContent, replySender } = req.body;
  const msg = sendMessage(req.params.id, sender, content, burnAfterRead, emojiEncrypted, replyTo, replyContent, replySender);
  broadcast({ type: 'private_message', conversationId: req.params.id, message: msg });
  res.json(msg);
});

app.post('/api/messages/:id/burn', (req, res) => {
  burnMessage(req.params.id);
  broadcast({ type: 'message_burned', messageId: req.params.id });
  res.json({ success: true });
});

app.put('/api/messages/:id/edit', (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Missing content' });
  const msg = editMessage(req.params.id, content);
  if (msg) {
    broadcast({ type: 'message_edited', messageId: req.params.id, content: msg.content });
    res.json(msg);
  } else res.status(404).json({ error: 'Message not found' });
});

app.post('/api/messages/:id/delete', (req, res) => {
  const msg = deleteMessage(req.params.id);
  if (msg) {
    broadcast({ type: 'message_deleted', messageId: req.params.id });
    res.json({ success: true });
  } else res.status(404).json({ error: 'Message not found' });
});

app.post('/api/messages/:id/reply', (req, res) => {
  const { sender, content, emojiEncrypted } = req.body;
  if (!sender || !content) return res.status(400).json({ error: 'Missing sender or content' });
  const msg = replyToMessage(req.params.id, sender, content, req.params.id, emojiEncrypted);
  if (msg) {
    broadcast({ type: 'message_reply', conversationId: msg.conversation_id, message: msg });
    res.json(msg);
  } else res.status(404).json({ error: 'Message not found' });
});

// ===== OPEN CHAT =====
app.get('/api/open-chat', (req, res) => {
  res.json(getOpenChatMessages());
});

app.post('/api/open-chat', (req, res) => {
  const { sender, content, emojiEncrypted } = req.body;
  const msg = sendOpenChatMessage(sender, content, emojiEncrypted);
  broadcast({ type: 'open_chat', message: msg });
  res.json(msg);
});

app.put('/api/open-chat/:id/edit', (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Missing content' });
  const msg = editOpenChatMessage(req.params.id, content);
  if (msg) {
    broadcast({ type: 'open_chat_edited', messageId: req.params.id, content: msg.content });
    res.json(msg);
  } else res.status(404).json({ error: 'Message not found' });
});

app.post('/api/open-chat/:id/delete', (req, res) => {
  const msg = deleteOpenChatMessage(req.params.id);
  if (msg) {
    broadcast({ type: 'open_chat_deleted', messageId: req.params.id });
    res.json({ success: true });
  } else res.status(404).json({ error: 'Message not found' });
});

app.delete('/api/open-chat/clear', (req, res) => {
  const result = clearOpenChatMessages();
  broadcast({ type: 'open_chat_cleared' });
  res.json(result);
});

// ===== USER SEARCH =====
app.get('/api/users/search', (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 1) return res.json([]);
  res.json(searchUsers(q));
});

app.get('/api/users/:handle/profile', (req, res) => {
  const profile = getUserProfile(req.params.handle);
  if (!profile) return res.status(404).json({ error: 'User not found' });
  res.json(profile);
});

// ===== SMS =====
app.get('/api/sms', (req, res) => {
  const { handle } = req.query;
  if (!handle) return res.status(400).json({ error: 'Missing handle' });
  res.json(getSMS(handle));
});

app.post('/api/sms', (req, res) => {
  const { sender, recipient, content, burnAfterRead } = req.body;
  if (!sender || !recipient || !content) return res.status(400).json({ error: 'Missing fields' });
  const msg = sendSMS(sender, recipient, content, burnAfterRead);
  broadcast({ type: 'sms', message: msg });
  res.json(msg);
});

app.post('/api/sms/:id/burn', (req, res) => {
  burnSMS(req.params.id);
  broadcast({ type: 'sms_burned', messageId: req.params.id });
  res.json({ success: true });
});

// ===== USER SETTINGS =====
app.get('/api/settings/:handle', (req, res) => {
  const settings = getUserSettings(req.params.handle);
  res.json(settings || {});
});

app.post('/api/settings/:handle', (req, res) => {
  const { theme, avatar } = req.body;
  saveUserSettings(req.params.handle, { theme, avatar });
  res.json({ success: true });
});

// ===== FILE UPLOADS =====
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const fileUrl = '/uploads/' + req.file.filename;
  res.json({ url: fileUrl, originalname: req.file.originalname, size: req.file.size });
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===== ESCROW =====
app.post('/api/escrow', (req, res) => {
  const { sender, recipient, amount, description } = req.body;
  if (!sender || !recipient || !amount) return res.status(400).json({ error: 'Missing fields' });
  const escrow = createEscrow(sender, recipient, amount, description);
  broadcast({ type: 'escrow_created', escrow });
  res.json(escrow);
});

app.get('/api/escrow', (req, res) => {
  const { handle } = req.query;
  if (!handle) return res.status(400).json({ error: 'Missing handle' });
  res.json(getEscrowsForHandle(handle));
});

app.post('/api/escrow/:id/release', (req, res) => {
  const escrow = updateEscrowStatus(req.params.id, 'released');
  if (escrow) { broadcast({ type: 'escrow_updated', escrow }); res.json(escrow); }
  else res.status(404).json({ error: 'Not found' });
});

app.post('/api/escrow/:id/dispute', (req, res) => {
  const escrow = updateEscrowStatus(req.params.id, 'disputed');
  if (escrow) { broadcast({ type: 'escrow_updated', escrow }); res.json(escrow); }
  else res.status(404).json({ error: 'Not found' });
});

app.post('/api/escrow/:id/cancel', (req, res) => {
  const escrow = updateEscrowStatus(req.params.id, 'cancelled');
  if (escrow) { broadcast({ type: 'escrow_updated', escrow }); res.json(escrow); }
  else res.status(404).json({ error: 'Not found' });
});

// ===== MESSAGE SEARCH =====
app.get('/api/search/messages', (req, res) => {
  const { handle, q } = req.query;
  if (!handle || !q) return res.status(400).json({ error: 'Missing params' });
  res.json(searchMessages(handle, q));
});

// ===== POSTS =====
app.get('/api/posts', (req, res) => {
  res.json(getPosts());
});

app.post('/api/posts', (req, res) => {
  const { author, authorHandle, content, emojiEncrypted, burnAfter, authorAvatar } = req.body;
  if (!author || !content) return res.status(400).json({ error: 'Missing author or content' });
  const post = createPost(author, authorHandle, content, emojiEncrypted, burnAfter, authorAvatar);
  broadcast({ type: 'new_post', post });
  res.json(post);
});

app.delete('/api/posts/:id', (req, res) => {
  const success = deletePost(req.params.id);
  if (success) {
    broadcast({ type: 'post_deleted', postId: req.params.id });
    res.json({ success: true });
  } else res.status(404).json({ error: 'Post not found' });
});

app.post('/api/posts/:id/like', (req, res) => {
  const { userHandle } = req.body;
  if (!userHandle) return res.status(400).json({ error: 'Missing userHandle' });
  const result = likePost(req.params.id, userHandle);
  if (result) {
    broadcast({ type: 'post_liked', postId: req.params.id, likes: result.likes, dislikes: result.dislikes, liked_by: result.liked_by, disliked_by: result.disliked_by });
    res.json(result);
  } else res.status(404).json({ error: 'Post not found' });
});

app.post('/api/posts/:id/dislike', (req, res) => {
  const { userHandle } = req.body;
  if (!userHandle) return res.status(400).json({ error: 'Missing userHandle' });
  const result = dislikePost(req.params.id, userHandle);
  if (result) {
    broadcast({ type: 'post_disliked', postId: req.params.id, likes: result.likes, dislikes: result.dislikes, liked_by: result.liked_by, disliked_by: result.disliked_by });
    res.json(result);
  } else res.status(404).json({ error: 'Post not found' });
});

app.post('/api/posts/:id/share', (req, res) => {
  const post = sharePost(req.params.id);
  if (post) {
    broadcast({ type: 'post_shared', postId: req.params.id, shares: post.shares });
    res.json(post);
  } else res.status(404).json({ error: 'Post not found' });
});

app.put('/api/posts/:id', (req, res) => {
  const { content, emojiEncrypted, burnAfter } = req.body;
  const post = updatePost(req.params.id, { content, emoji_encrypted: emojiEncrypted, burn_after: burnAfter });
  if (post) {
    broadcast({ type: 'post_updated', post });
    res.json(post);
  } else res.status(404).json({ error: 'Post not found' });
});

// ===== REPLIES =====
app.get('/api/posts/:id/replies', (req, res) => {
  res.json(getRepliesForPost(req.params.id));
});

app.post('/api/posts/:id/replies', (req, res) => {
  const { author, content } = req.body;
  if (!author || !content) return res.status(400).json({ error: 'Missing author or content' });
  const reply = createReply(req.params.id, author, content);
  if (reply) {
    broadcast({ type: 'new_reply', postId: req.params.id, reply });
    res.json(reply);
  } else res.status(404).json({ error: 'Post not found' });
});

// ===== SYN TERMINAL =====
const synUsers = new Map(); // handle -> { granted: boolean }

app.post('/api/syn/exec', (req, res) => {
  const { command } = req.body;
  if (!command || typeof command !== 'string') {
    return res.status(400).json({ error: 'Missing command' });
  }

  // Block obviously dangerous commands
  const blocked = ['rm -rf /', 'rm -rf /*', ':(){ :|:& };:', 'mkfs', 'dd if=/dev/zero', '> /dev/sda', 'shutdown', 'reboot', 'poweroff'];
  if (blocked.some(b => command.includes(b))) {
    return res.status(403).json({ error: 'Command blocked for safety' });
  }

  exec(command, { timeout: 30000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
    if (error) {
      return res.json({ stdout: '', stderr: error.message, exitCode: error.code });
    }
    res.json({ stdout, stderr, exitCode: 0 });
  });
});

// ===== WEBSOCKET =====
wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
  ws.on('error', () => clients.delete(ws));
});

// Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 7777;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Omerta Server running on port ${PORT}`);
});