cd ~/Omerta

# 1. Write updated db.js with like/dislike tracking
cat > db.js << 'DBEOF'
import { readFileSync, writeFileSync, existsSync } from 'fs';
const DB_PATH = './omerta.json';
function loadDb() {
  if (!existsSync(DB_PATH)) return { users: [], conversations: [], messages: [], openChatMessages: [], posts: [] };
  return JSON.parse(readFileSync(DB_PATH, 'utf8'));
}
function saveDb(db) { writeFileSync(DB_PATH, JSON.stringify(db, null, 2)); }
let db = loadDb();
if (!db.posts) db.posts = [];
for (const post of db.posts) {
  if (!post.replies) post.replies = [];
  if (!post.liked_by) post.liked_by = [];
  if (!post.disliked_by) post.disliked_by = [];
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
export function sendMessage(conversationId, sender, content, burnAfterRead = 0, emojiEncrypted = 0) {
  const msg = { id: Date.now(), conversation_id: Number(conversationId), sender_handle: sender, content, timestamp: Date.now(), burn_after_read: burnAfterRead ? 1 : 0, is_burned: 0, emoji_encrypted: emojiEncrypted ? 1 : 0 };
  db.messages.push(msg); saveDb(db); return msg;
}
export function getMessagesForConversation(conversationId) {
  return db.messages.filter(m => m.conversation_id === Number(conversationId)).sort((a,b) => a.timestamp - b.timestamp);
}
export function burnMessage(messageId) {
  const msg = db.messages.find(m => m.id === Number(messageId));
  if (msg) { msg.is_burned = 1; msg.content = '// BURNED //'; saveDb(db); }
}
export function sendOpenChatMessage(sender, content, emojiEncrypted = 0) {
  const msg = { id: Date.now(), sender_handle: sender, content, timestamp: Date.now(), emoji_encrypted: emojiEncrypted ? 1 : 0 };
  db.openChatMessages.push(msg); saveDb(db); return msg;
}
export function getOpenChatMessages() {
  return db.openChatMessages.slice(-100);
}
export function createPost(author, authorHandle, content, emojiEncrypted = 0, burnAfter = 0) {
  const post = { id: 'p' + Date.now(), author, author_handle: authorHandle, content, emoji_encrypted: emojiEncrypted ? 1 : 0, timestamp: Date.now(), likes: 0, dislikes: 0, comments: 0, shares: 0, is_burned: 0, burn_after: burnAfter ? 1 : 0, replies: [], liked_by: [], disliked_by: [] };
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
  if (post) {
    if (updates.content !== undefined) post.content = updates.content;
    if (updates.emoji_encrypted !== undefined) post.emoji_encrypted = updates.emoji_encrypted ? 1 : 0;
    if (updates.burn_after !== undefined) post.burn_after = updates.burn_after ? 1 : 0;
    saveDb(db); return post;
  }
  return null;
}
export function sharePost(postId) {
  const post = db.posts.find(p => p.id === postId);
  if (post) { post.shares = (post.shares || 0) + 1; saveDb(db); return post; }
  return null;
}
export function likePost(postId, userHandle) {
  const post = db.posts.find(p => p.id === postId);
  if (!post) return null;
  if (!post.liked_by) post.liked_by = [];
  if (!post.disliked_by) post.disliked_by = [];
  if (post.liked_by.includes(userHandle)) {
    post.liked_by = post.liked_by.filter(h => h !== userHandle);
  } else {
    post.liked_by.push(userHandle);
    post.disliked_by = post.disliked_by.filter(h => h !== userHandle);
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
  if (post.disliked_by.includes(userHandle)) {
    post.disliked_by = post.disliked_by.filter(h => h !== userHandle);
  } else {
    post.disliked_by.push(userHandle);
    post.liked_by = post.liked_by.filter(h => h !== userHandle);
  }
  post.likes = post.liked_by.length;
  post.dislikes = post.disliked_by.length;
  saveDb(db);
  return { ...post, likes: post.likes, dislikes: post.dislikes, liked_by: post.liked_by, disliked_by: post.disliked_by };
}
export function createReply(postId, author, content) {
  const post = db.posts.find(p => p.id === postId);
  if (!post) return null;
  const reply = { id: 'r' + Date.now(), post_id: postId, author, content, timestamp: Date.now() };
  if (!post.replies) post.replies = [];
  post.replies.push(reply);
  post.comments = post.replies.length;
  saveDb(db); return reply;
}
export function getRepliesForPost(postId) {
  const post = db.posts.find(p => p.id === postId);
  return post?.replies || [];
}
DBEOF

# 2. Write updated server.js with CORS + like/dislike endpoints
cat > server.js << 'SRVEOF'
import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import {
  createUser, verifyUser, getOrCreateConversation, getConversationsForUser,
  sendMessage, getMessagesForConversation, burnMessage,
  sendOpenChatMessage, getOpenChatMessages,
  createPost, getPosts, deletePost, sharePost, updatePost,
  likePost, dislikePost,
  createReply, getRepliesForPost
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

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

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
  const { sender, content, burnAfterRead, emojiEncrypted } = req.body;
  const msg = sendMessage(req.params.id, sender, content, burnAfterRead, emojiEncrypted);
  broadcast({ type: 'private_message', conversationId: req.params.id, message: msg });
  res.json(msg);
});

app.post('/api/messages/:id/burn', (req, res) => {
  burnMessage(req.params.id);
  broadcast({ type: 'message_burned', messageId: req.params.id });
  res.json({ success: true });
});

app.get('/api/open-chat', (req, res) => {
  res.json(getOpenChatMessages());
});

app.post('/api/open-chat', (req, res) => {
  const { sender, content, emojiEncrypted } = req.body;
  const msg = sendOpenChatMessage(sender, content, emojiEncrypted);
  broadcast({ type: 'open_chat', message: msg });
  res.json(msg);
});

app.get('/api/posts', (req, res) => {
  res.json(getPosts());
});

app.post('/api/posts', (req, res) => {
  const { author, authorHandle, content, emojiEncrypted, burnAfter } = req.body;
  if (!author || !content) return res.status(400).json({ error: 'Missing author or content' });
  const post = createPost(author, authorHandle, content, emojiEncrypted, burnAfter);
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

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
  ws.on('error', () => clients.delete(ws));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 7777;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Omerta Server running on port ${PORT}`);
});
SRVEOF

# 3. Download current frontend assets (correct hashes)
mkdir -p dist/assets
python3 -c "
import urllib.request, os
files = {
  'dist/assets/index-kpUVfuPf.js': 'https://trj3y4k4uwhvc.kimi.show/assets/index-kpUVfuPf.js',
  'dist/assets/index-CcWZbQXe.css': 'https://trj3y4k4uwhvc.kimi.show/assets/index-CcWZbQXe.css',
  'dist/logo.png': 'https://trj3y4k4uwhvc.kimi.show/logo.png',
}
headers = {'User-Agent': 'Mozilla/5.0'}
for local_path, url in files.items():
  try:
    req = urllib.request.Request(url, headers=headers)
    data = urllib.request.urlopen(req).read()
    with open(local_path, 'wb') as f: f.write(data)
    print(f'OK: {local_path} = {len(data)} bytes')
  except Exception as e:
    print(f'FAIL: {local_path} -> {e}')
"

# 4. Write clean index.html with correct asset hashes
cat > dist/index.html << 'HTMLEOF'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <title>Omerta</title>
    <script type="module" crossorigin src="./assets/index-kpUVfuPf.js"></script>
    <link rel="stylesheet" crossorigin href="./assets/index-CcWZbQXe.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
HTMLEOF

# 5. Kill old server and start fresh
pkill -f "node server.js" 2>/dev/null; sleep 2
node server.js
