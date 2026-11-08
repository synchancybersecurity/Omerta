const KEY = "omerta_db_v1";

type User = { id: number; handle: string; passphrase: string; role: string; created_at: number };
type Conv = { id: number; user1_handle: string; user2_handle: string; created_at: number };
type Msg = {
  id: number;
  conversation_id: number;
  sender_handle: string;
  content: string;
  timestamp: number;
  burn_after_read: number;
  is_burned: number;
  emoji_encrypted: number;
  e2e_encrypted: number;
  reply_to?: string | number | null;
  reply_content?: string | null;
  reply_sender?: string | null;
  edited?: number;
  deleted?: number;
};
type Post = {
  id: string;
  author: string;
  author_handle: string;
  author_avatar: string | null;
  content: string;
  emoji_encrypted: number;
  timestamp: number;
  likes: number;
  dislikes: number;
  comments: number;
  shares: number;
  is_burned: number;
  burn_after: number;
  replies: Array<{ id: string; post_id: string; author: string; content: string; timestamp: number }>;
  liked_by: string[];
  disliked_by: string[];
};
type Room = {
  id: string;
  name: string;
  creator_handle: string;
  creator_role?: string;
  is_locked: number;
  password?: string | null;
  locked_by?: string | null;
  lock_reason?: string | null;
  created_at: number;
};
type Db = {
  users: User[];
  conversations: Conv[];
  messages: Msg[];
  openChatMessages: Array<Record<string, unknown>>;
  posts: Post[];
  smsMessages: Array<Record<string, unknown>>;
  userSettings: Record<string, Record<string, unknown>>;
  escrows: Array<Record<string, unknown>>;
  chatRooms: Room[];
  roomMessages: Array<Record<string, unknown>>;
  roomClearedAt: number;
  houseSettings: { holdingWallet: string; feeWallet: string; houseFeePercent: number };
  publicKeys: Record<string, string>;
};

const ROOM_CLEAR_MS = 48 * 60 * 60 * 1000;

function emptyDb(): Db {
  const now = Date.now();
  return {
    users: [
      { id: 1, handle: "vesper", passphrase: "seed-vesper", role: "basic", created_at: 1710000000 },
      { id: 2, handle: "ghost", passphrase: "seed-ghost", role: "moderator", created_at: 1710001000 },
    ],
    conversations: [],
    messages: [],
    openChatMessages: [
      {
        id: now - 5000,
        sender_handle: "vesper",
        content: "The house is open. Handles only.",
        timestamp: now - 60000,
        emoji_encrypted: 0,
        e2e_encrypted: 0,
        reply_to: null,
        reply_content: null,
        reply_sender: null,
      },
    ],
    posts: [
      {
        id: "p-seed",
        author: "Vesper",
        author_handle: "vesper",
        author_avatar: "/avatars/tarot-tower.jpg",
        content: "Coin is up. Speak, or keep the silence.",
        emoji_encrypted: 0,
        timestamp: now - 120000,
        likes: 1,
        dislikes: 0,
        comments: 0,
        shares: 0,
        is_burned: 0,
        burn_after: 0,
        replies: [],
        liked_by: ["ghost"],
        disliked_by: [],
      },
    ],
    smsMessages: [],
    userSettings: {
      vesper: { avatar: "/avatars/tarot-tower.jpg" },
      ghost: { avatar: "/avatars/zodiac-scorpio.jpg" },
    },
    escrows: [],
    chatRooms: [
      {
        id: "room-seed",
        name: "The Back Room",
        creator_handle: "ghost",
        creator_role: "moderator",
        is_locked: 0,
        password: null,
        locked_by: null,
        lock_reason: null,
        created_at: now - 30000,
      },
    ],
    roomMessages: [
      {
        id: now - 4000,
        room_id: "room-seed",
        sender_handle: "ghost",
        content: "Back room is clear.",
        timestamp: now - 20000,
        emoji_encrypted: 0,
        e2e_encrypted: 0,
        reply_to: null,
        reply_content: null,
        reply_sender: null,
      },
    ],
    roomClearedAt: now,
    houseSettings: { holdingWallet: "", feeWallet: "", houseFeePercent: 2.25 },
    publicKeys: {},
  };
}

let seq = 10;
function nid() {
  seq += 1;
  return Date.now() + seq;
}

let db: Db = emptyDb();
let loaded = false;

function load() {
  if (loaded || typeof localStorage === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) db = { ...emptyDb(), ...JSON.parse(raw) };
  } catch {
    db = emptyDb();
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* memory copy still stands */
  }
}

export function grantLocalRole(handle: string, role: "admin" | "moderator" | "basic") {
  load();
  const name = handle.trim();
  if (!name) return;
  const existing = db.users.find((u) => u.handle.toLowerCase() === name.toLowerCase());
  if (existing) {
    existing.role = role;
  } else {
    db.users.push({
      id: nid(),
      handle: name,
      passphrase: "session-" + nid(),
      role,
      created_at: Math.floor(Date.now() / 1000),
    });
  }
  save();
}

function clearRoomsIfDue() {
  const started = Number(db.roomClearedAt) || 0;
  if (!started) {
    db.roomClearedAt = Date.now();
    save();
    return;
  }
  if (Date.now() - started < ROOM_CLEAR_MS) return;
  db.openChatMessages = [];
  db.roomMessages = [];
  db.roomClearedAt = Date.now();
  save();
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function readJson(input: RequestInfo | URL, init?: RequestInit) {
  const body = init?.body;
  if (typeof body === "string") {
    try { return JSON.parse(body); } catch { return {}; }
  }
  if (input instanceof Request) {
    try { return await input.clone().json(); } catch { return {}; }
  }
  return {};
}

function publicUser(u: User) {
  return { id: u.id, handle: u.handle, role: u.role || "basic", created_at: u.created_at };
}

function viewPost(p: Post) {
  return {
    ...p,
    comments: (p.replies || []).length,
    likes: (p.liked_by || []).length,
    dislikes: (p.disliked_by || []).length,
  };
}

async function route(path: string, method: string, input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  load();
  clearRoomsIfDue();
  const url = new URL(path, "http://local");
  const q = url.searchParams;
  const parts = url.pathname.split("/").filter(Boolean); // api, ...
  const seg = parts.slice(1);

  if (seg[0] === "auth" && seg[1] === "login" && method === "POST") {
    const body = await readJson(input, init);
    const handle = String(body.handle || "").trim();
    const passphrase = String(body.passphrase || "").trim();
    const user = db.users.find((u) => u.handle.toLowerCase() === handle.toLowerCase());
    if (!user) return json({ error: "No such handle", code: "unknown" }, 401);
    if (user.passphrase !== passphrase) return json({ error: "Wrong passphrase", code: "bad_passphrase" }, 401);
    return json({ success: true, handle: user.handle, role: user.role || "basic" });
  }

  if (seg[0] === "auth" && seg[1] === "register" && method === "POST") {
    const body = await readJson(input, init);
    const handle = String(body.handle || "").trim();
    const passphrase = String(body.passphrase || "").trim();
    if (!handle || !passphrase) return json({ error: "Missing fields" }, 400);
    if (db.users.some((u) => u.handle.toLowerCase() === handle.toLowerCase())) {
      return json({ error: "Wrong passphrase", code: "bad_passphrase" }, 401);
    }
    const role = handle.toLowerCase() === "flint" ? "admin" : "basic";
    const user: User = { id: nid(), handle, passphrase, role, created_at: Math.floor(Date.now() / 1000) };
    db.users.push(user);
    save();
    return json({ success: true, handle: user.handle, role: user.role });
  }

  if (seg[0] === "users" && seg[1] === "search" && method === "GET") {
    const query = (q.get("q") || "").toLowerCase();
    if (!query) return json([]);
    return json(
      db.users.filter((u) => u.handle.toLowerCase().includes(query)).slice(0, 20).map(publicUser),
    );
  }

  if (seg[0] === "users" && seg.length === 1 && method === "GET") {
    return json(db.users.map(publicUser));
  }

  if (seg[0] === "users" && seg[2] === "profile" && method === "GET") {
    const handle = decodeURIComponent(seg[1]);
    const user = db.users.find((u) => u.handle === handle);
    if (!user) return json({ error: "Not found" }, 404);
    const settings = db.userSettings[handle] || {};
    let avatar = (settings.avatar as string) || null;
    if (!avatar) {
      const post = [...db.posts].reverse().find((p) => p.author_handle === handle && p.author_avatar);
      avatar = post?.author_avatar || null;
    }
    return json({ handle: user.handle, created_at: user.created_at, role: user.role || "basic", avatar });
  }

  if (seg[0] === "users" && seg[2] === "promote" && method === "POST") {
    const { role, adminHandle } = await readJson(input, init);
    const admin = db.users.find((u) => u.handle === adminHandle);
    if (!admin || admin.role !== "admin") return json({ error: "Admin only" }, 403);
    const user = db.users.find((u) => u.handle === decodeURIComponent(seg[1]));
    if (!user) return json({ error: "User not found" }, 404);
    user.role = role;
    save();
    return json({ success: true, handle: user.handle, role: user.role });
  }

  if (seg[0] === "settings" && seg[1] && method === "GET") {
    return json(db.userSettings[decodeURIComponent(seg[1])] || {});
  }
  if (seg[0] === "settings" && seg[1] && method === "POST") {
    const handle = decodeURIComponent(seg[1]);
    const body = await readJson(input, init);
    db.userSettings[handle] = { ...(db.userSettings[handle] || {}), ...body, updated_at: Date.now() };
    save();
    return json({ success: true });
  }

  if (seg[0] === "conversations" && seg.length === 1 && method === "GET") {
    const handle = q.get("handle") || "";
    const rows = db.conversations
      .filter((c) => c.user1_handle === handle || c.user2_handle === handle)
      .map((c) => {
        const msgs = db.messages.filter((m) => m.conversation_id === c.id).sort((a, b) => a.timestamp - b.timestamp);
        const last = msgs[msgs.length - 1];
        return {
          ...c,
          last_message: last?.content || null,
          last_timestamp: last?.timestamp || null,
          unread: msgs.filter((m) => m.sender_handle !== handle && !m.is_burned).length,
        };
      })
      .sort((a, b) => (b.last_timestamp || 0) - (a.last_timestamp || 0));
    return json(rows);
  }

  if (seg[0] === "conversations" && seg.length === 1 && method === "POST") {
    const { user1, user2 } = await readJson(input, init);
    const [a, b] = [user1, user2].sort();
    let conv = db.conversations.find((c) => c.user1_handle === a && c.user2_handle === b);
    if (!conv) {
      conv = { id: nid(), user1_handle: a, user2_handle: b, created_at: Math.floor(Date.now() / 1000) };
      db.conversations.push(conv);
      save();
    }
    return json(conv);
  }

  if (seg[0] === "conversations" && seg[2] === "messages" && method === "GET") {
    const id = Number(seg[1]);
    return json(db.messages.filter((m) => m.conversation_id === id).sort((a, b) => a.timestamp - b.timestamp));
  }

  if (seg[0] === "conversations" && seg[2] === "messages" && method === "POST") {
    const body = await readJson(input, init);
    const msg: Msg = {
      id: nid(),
      conversation_id: Number(seg[1]),
      sender_handle: body.sender,
      content: body.content,
      timestamp: Date.now(),
      burn_after_read: body.burnAfterRead ? 1 : 0,
      is_burned: 0,
      emoji_encrypted: body.emojiEncrypted ? 1 : 0,
      e2e_encrypted: body.e2eEncrypted ? 1 : 0,
      reply_to: body.replyTo ?? null,
      reply_content: body.replyContent ?? null,
      reply_sender: body.replySender ?? null,
    };
    db.messages.push(msg);
    save();
    return json(msg);
  }

  if (seg[0] === "messages" && seg[2] === "burn" && method === "POST") {
    const msg = db.messages.find((m) => m.id === Number(seg[1]));
    if (msg) { msg.is_burned = 1; msg.content = "// BURNED //"; save(); }
    return json({ success: true });
  }

  if (seg[0] === "open-chat" && seg[1] === "clear" && method === "DELETE") {
    const count = db.openChatMessages.length;
    db.openChatMessages = [];
    save();
    return json({ success: true, count });
  }

  if (seg[0] === "open-chat" && seg.length === 1 && method === "GET") {
    return json(db.openChatMessages.slice(-100));
  }

  if (seg[0] === "open-chat" && seg.length === 1 && method === "POST") {
    const body = await readJson(input, init);
    const msg = {
      id: nid(),
      sender_handle: body.sender,
      content: body.content,
      timestamp: Date.now(),
      emoji_encrypted: body.emojiEncrypted ? 1 : 0,
      e2e_encrypted: body.e2eEncrypted ? 1 : 0,
      reply_to: body.replyTo ?? null,
      reply_content: body.replyContent ?? null,
      reply_sender: body.replySender ?? null,
    };
    db.openChatMessages.push(msg);
    save();
    return json(msg);
  }

  if (seg[0] === "sms" && seg.length === 1 && method === "GET") {
    const handle = q.get("handle") || "";
    const rows = db.smsMessages
      .filter((m) => m.sender_handle === handle || m.recipient === handle)
      .sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
    return json(rows);
  }

  if (seg[0] === "sms" && seg.length === 1 && method === "POST") {
    const body = await readJson(input, init);
    const msg = {
      id: nid(),
      sender_handle: body.sender,
      recipient: body.recipient,
      content: body.content,
      timestamp: Date.now(),
      burn_after_read: body.burnAfterRead ? 1 : 0,
      is_burned: 0,
    };
    db.smsMessages.unshift(msg);
    save();
    return json(msg);
  }

  if (seg[0] === "sms" && seg[2] === "burn" && method === "POST") {
    const msg = db.smsMessages.find((m) => m.id === Number(seg[1]));
    if (msg) { msg.is_burned = 1; msg.content = "// BURNED //"; save(); }
    return json({ success: true });
  }

  if (seg[0] === "upload" && method === "POST") {
    const body = init?.body;
    if (body instanceof FormData) {
      const file = body.get("file");
      if (file instanceof File) {
        const url = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });
        return json({ url });
      }
    }
    return json({ error: "No file" }, 400);
  }

  if (seg[0] === "house" && seg[1] === "settings" && method === "GET") {
    return json(db.houseSettings);
  }
  if (seg[0] === "house" && seg[1] === "settings" && method === "POST") {
    const body = await readJson(input, init);
    db.houseSettings = { ...db.houseSettings, ...body };
    save();
    return json({ success: true });
  }

  if (seg[0] === "escrow" && seg[1] === "all" && method === "GET") {
    return json([...db.escrows].sort((a, b) => Number(b.created_at) - Number(a.created_at)));
  }

  if (seg[0] === "escrow" && seg.length === 1 && method === "GET") {
    const handle = q.get("handle") || "";
    return json(
      db.escrows
        .filter((e) => e.sender === handle || e.recipient === handle)
        .sort((a, b) => Number(b.created_at) - Number(a.created_at)),
    );
  }

  if (seg[0] === "escrow" && seg.length === 1 && method === "POST") {
    const body = await readJson(input, init);
    const amount = Number(body.amount);
    const pct = db.houseSettings.houseFeePercent || 2.25;
    const houseFee = Number((amount * (pct / 100)).toFixed(2));
    const escrow = {
      id: "e" + nid(),
      sender: body.sender,
      recipient: body.recipient,
      amount,
      house_fee: houseFee,
      net_amount: Number((amount - houseFee).toFixed(2)),
      house_fee_percent: pct,
      description: body.description || "",
      status: "pending",
      created_at: Date.now(),
      resolved_at: null,
      resolved_by: null,
      resolution_note: null,
    };
    db.escrows.unshift(escrow);
    save();
    return json(escrow);
  }

  if (seg[0] === "escrow" && seg[2] === "resolve" && method === "POST") {
    const body = await readJson(input, init);
    const escrow = db.escrows.find((e) => e.id === seg[1]);
    if (!escrow) return json({ error: "Not found" }, 404);
    escrow.status = body.resolution;
    escrow.resolved_at = Date.now();
    escrow.resolved_by = body.adminHandle;
    escrow.resolution_note = body.note || "";
    save();
    return json(escrow);
  }

  if (seg[0] === "escrow" && seg.length === 3 && method === "POST") {
    const map: Record<string, string> = { release: "released", dispute: "disputed", cancel: "cancelled" };
    const escrow = db.escrows.find((e) => e.id === seg[1]);
    if (!escrow || !map[seg[2]]) return json({ error: "Not found" }, 404);
    escrow.status = map[seg[2]];
    save();
    return json(escrow);
  }

  if (seg[0] === "search" && seg[1] === "messages" && method === "GET") {
    const handle = q.get("handle") || "";
    const query = (q.get("q") || "").toLowerCase();
    const results: Array<Record<string, unknown>> = [];
    for (const conv of db.conversations.filter((c) => c.user1_handle === handle || c.user2_handle === handle)) {
      const other = conv.user1_handle === handle ? conv.user2_handle : conv.user1_handle;
      for (const msg of db.messages.filter((m) => m.conversation_id === conv.id && m.content.toLowerCase().includes(query))) {
        results.push({ ...msg, other_handle: other });
      }
    }
    return json(results.slice(0, 50));
  }

  if (seg[0] === "chat-rooms" && seg.length === 1 && method === "GET") {
    return json(
      [...db.chatRooms]
        .sort((a, b) => b.created_at - a.created_at)
        .map(({ password: _password, ...room }) => room),
    );
  }

  if (seg[0] === "chat-rooms" && seg.length === 1 && method === "POST") {
    const body = await readJson(input, init);
    const locked = Boolean(body.isLocked);
    const password = locked ? String(body.password || "").trim() : null;
    if (locked && !password) return json({ error: "A locked room needs a passphrase" }, 400);
    const room: Room = {
      id: "room-" + nid(),
      name: body.name || "Untitled Room",
      creator_handle: body.creatorHandle,
      creator_role: body.role || "basic",
      is_locked: locked ? 1 : 0,
      password,
      locked_by: locked ? body.creatorHandle : null,
      lock_reason: locked ? "Passphrase" : null,
      created_at: Date.now(),
    };
    db.chatRooms.unshift(room);
    save();
    return json(room);
  }

  if (seg[0] === "chat-rooms" && seg[2] === "verify" && method === "POST") {
    const body = await readJson(input, init);
    const room = db.chatRooms.find((r) => r.id === seg[1]);
    if (!room) return json({ valid: false });
    if (!room.is_locked) return json({ valid: true });
    if (!room.password) return json({ valid: false });
    return json({ valid: room.password === String(body.password || "") });
  }

  if (seg[0] === "chat-rooms" && seg[2] === "lock" && method === "POST") {
    const body = await readJson(input, init);
    const room = db.chatRooms.find((r) => r.id === seg[1]);
    if (!room) return json({ error: "Not found" }, 404);
    room.is_locked = 1;
    room.locked_by = body.lockedBy;
    room.lock_reason = body.reason || "Locked";
    save();
    return json(room);
  }

  if (seg[0] === "chat-rooms" && seg[2] === "unlock" && method === "POST") {
    const room = db.chatRooms.find((r) => r.id === seg[1]);
    if (!room) return json({ error: "Not found" }, 404);
    room.is_locked = 0;
    room.locked_by = null;
    room.lock_reason = null;
    save();
    return json(room);
  }

  if (seg[0] === "chat-rooms" && seg[2] === "messages" && method === "GET") {
    return json(
      db.roomMessages
        .filter((m) => m.room_id === seg[1])
        .sort((a, b) => Number(a.timestamp) - Number(b.timestamp)),
    );
  }

  if (seg[0] === "chat-rooms" && seg[2] === "messages" && method === "POST") {
    const body = await readJson(input, init);
    const msg = {
      id: nid(),
      room_id: seg[1],
      sender_handle: body.sender,
      content: body.content,
      timestamp: Date.now(),
      emoji_encrypted: body.emojiEncrypted ? 1 : 0,
      e2e_encrypted: body.e2eEncrypted ? 1 : 0,
      reply_to: body.replyTo ?? null,
      reply_content: body.replyContent ?? null,
      reply_sender: body.replySender ?? null,
    };
    db.roomMessages.push(msg);
    save();
    return json(msg);
  }

  if (seg[0] === "chat-rooms" && seg.length === 2 && method === "DELETE") {
    db.chatRooms = db.chatRooms.filter((r) => r.id !== seg[1]);
    db.roomMessages = db.roomMessages.filter((m) => m.room_id !== seg[1]);
    save();
    return json({ success: true });
  }

  if (seg[0] === "posts" && seg.length === 1 && method === "GET") {
    return json(
      db.posts.filter((p) => !p.is_burned).map(viewPost).sort((a, b) => b.timestamp - a.timestamp),
    );
  }

  if (seg[0] === "posts" && seg.length === 1 && method === "POST") {
    const body = await readJson(input, init);
    const post: Post = {
      id: "p" + nid(),
      author: body.author,
      author_handle: body.authorHandle,
      author_avatar: body.authorAvatar || null,
      content: body.content,
      emoji_encrypted: body.emojiEncrypted ? 1 : 0,
      timestamp: Date.now(),
      likes: 0,
      dislikes: 0,
      comments: 0,
      shares: 0,
      is_burned: 0,
      burn_after: body.burnAfter ? 1 : 0,
      replies: [],
      liked_by: [],
      disliked_by: [],
    };
    db.posts.unshift(post);
    if (body.authorAvatar && body.authorHandle) {
      db.userSettings[body.authorHandle] = { ...(db.userSettings[body.authorHandle] || {}), avatar: body.authorAvatar };
    }
    save();
    return json(post);
  }

  if (seg[0] === "posts" && seg.length === 2 && method === "PUT") {
    const body = await readJson(input, init);
    const post = db.posts.find((p) => p.id === seg[1]);
    if (!post) return json({ error: "Not found" }, 404);
    if (body.content !== undefined) post.content = body.content;
    if (body.emojiEncrypted !== undefined) post.emoji_encrypted = body.emojiEncrypted ? 1 : 0;
    if (body.burnAfter !== undefined) post.burn_after = body.burnAfter ? 1 : 0;
    save();
    return json(viewPost(post));
  }

  if (seg[0] === "posts" && seg.length === 2 && method === "DELETE") {
    const post = db.posts.find((p) => p.id === seg[1]);
    if (!post) return json({ error: "Not found" }, 404);
    post.is_burned = 1;
    save();
    return json({ success: true });
  }

  if (seg[0] === "posts" && seg[2] === "like" && method === "POST") {
    const { userHandle } = await readJson(input, init);
    const post = db.posts.find((p) => p.id === seg[1]);
    if (!post) return json({ error: "Not found" }, 404);
    if (post.liked_by.includes(userHandle)) post.liked_by = post.liked_by.filter((h) => h !== userHandle);
    else {
      post.liked_by.push(userHandle);
      post.disliked_by = post.disliked_by.filter((h) => h !== userHandle);
    }
    save();
    return json({ likes: post.liked_by.length, dislikes: post.disliked_by.length, liked_by: post.liked_by, disliked_by: post.disliked_by });
  }

  if (seg[0] === "posts" && seg[2] === "dislike" && method === "POST") {
    const { userHandle } = await readJson(input, init);
    const post = db.posts.find((p) => p.id === seg[1]);
    if (!post) return json({ error: "Not found" }, 404);
    if (post.disliked_by.includes(userHandle)) post.disliked_by = post.disliked_by.filter((h) => h !== userHandle);
    else {
      post.disliked_by.push(userHandle);
      post.liked_by = post.liked_by.filter((h) => h !== userHandle);
    }
    save();
    return json({ likes: post.liked_by.length, dislikes: post.disliked_by.length, liked_by: post.liked_by, disliked_by: post.disliked_by });
  }

  if (seg[0] === "posts" && seg[2] === "share" && method === "POST") {
    const post = db.posts.find((p) => p.id === seg[1]);
    if (!post) return json({ error: "Not found" }, 404);
    post.shares = (post.shares || 0) + 1;
    save();
    return json({ shares: post.shares });
  }

  if (seg[0] === "posts" && seg[2] === "replies" && method === "GET") {
    const post = db.posts.find((p) => p.id === seg[1]);
    return json(post?.replies || []);
  }

  if (seg[0] === "posts" && seg[2] === "replies" && method === "POST") {
    const body = await readJson(input, init);
    const post = db.posts.find((p) => p.id === seg[1]);
    if (!post) return json({ error: "Post not found" }, 404);
    const reply = { id: "r" + nid(), post_id: post.id, author: body.author, content: body.content, timestamp: Date.now() };
    post.replies.push(reply);
    save();
    return json(reply);
  }

  if (seg[0] === "keys" && seg[1] === "register" && method === "POST") {
    const { handle, publicKey } = await readJson(input, init);
    if (handle && publicKey) db.publicKeys[handle] = publicKey;
    save();
    return json({ success: true });
  }

  if (seg[0] === "keys" && seg[1] && method === "GET") {
    const handle = decodeURIComponent(seg[1]);
    const publicKey = db.publicKeys[handle];
    if (!publicKey) return json({ error: "Key not found" }, 404);
    return json({ handle, publicKey });
  }

  if (seg[0] === "syn" && seg[1] === "exec" && method === "POST") {
    const body = await readJson(input, init);
    const handle = String(body.handle || "").trim().toLowerCase();
    const user = db.users.find((u) => u.handle.toLowerCase() === handle);
    if (handle !== "flint" || !user || (user.role || "basic") !== "admin") {
      return json({ error: "Denied" }, 403);
    }
    return json({
      stdout: "Shell execution is disabled in this preview.\n",
      error: null,
    });
  }

  return json({ error: "Not found" }, 404);
}

export function installLocalApi() {
  if (typeof window === "undefined") return;
  const w = window as Window & { __omertaApi?: boolean };
  if (w.__omertaApi) return;
  w.__omertaApi = true;
  const orig = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    let path = raw;
    try {
      path = new URL(raw, window.location.origin).pathname + new URL(raw, window.location.origin).search;
    } catch { /* keep raw */ }
    const pathname = path.split("?")[0] || path;
    if (!pathname.startsWith("/api/")) return orig(input, init);
    const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    return route(path, method, input, init);
  };
}
