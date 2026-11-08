import { isSealed, openVault, sealVault } from "@omerta/vault-aes";
import { vaultGet, vaultSet, storeVaultFile, deleteVaultFile } from "@omerta/vault-store";
import { exchangeBoard, type PublicBoard } from "@omerta/board";
import { encryptMessage, encryptForRoom, exportPrivateKey, exportPublicKey, generateKeyPair, importPrivateKey, importPublicKey, openPrivate, roomKeyFromPassphrase } from "@omerta/utils/crypto";
import { asBitcoinWallet, createHouseWallet, exportHouseBtc, isBtcAddress, restoreHouseWallet, spotUsd } from "@omerta/chain";

const KEY = "omerta_db_v1";

type User = { id: number; handle: string; passphrase: string; role: string; created_at: number; suspended?: boolean };

type Policy = {
  lockdown: boolean;
  torOnly: boolean;
  ghost: boolean;
  forwardSecrecy: boolean;
  burnDefault: boolean;
  notifications: boolean;
  sound: boolean;
  intercept: boolean;
  keyRotation: boolean;
  contentFilter: boolean;
  suspendEnabled: boolean;
  announcements: boolean;
  userReports: boolean;
  modCanFilter: boolean;
  modCanReports: boolean;
  modCanAnnounce: boolean;
  modCanSuspend: boolean;
  autoSweep: boolean;
  lastRotation: number;
  lastSweep: number;
};
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
  houseSettings: { holdingWallet: string; feeWallet: string; houseFeePercent: number; chain: string };
  houseDeposits: HouseDeposit[];
  chainPayments: ChainPayment[];
  houseWallet: { address: string; key: string; phrase?: string } | null;
  payoutWallets: string[];
  publicKeys: Record<string, string>;
  userKeys: Record<string, { publicKey: string; privateKey: string; history?: Array<{ publicKey: string; privateKey: string }> }>;
  listings: Listing[];
  moneyUnit?: "btc";
  captures: Array<{ id: string; handle: string; kind: "screenshot" | "recording"; timestamp: number }>;
  wipes: Array<{ handle: string; at: number }>;
  policy: Policy;
  interceptLog: Array<{ t: number; handle: string; kind: string; bytes: number }>;
  reports: Array<{ id: string; reporter: string; target: string; kind: string; reason: string; ref: string; status: string; timestamp: number }>;
  removedRooms: string[];
};

type ChainPayment = {
  id: string;
  source: "auction" | "escrow";
  source_id: string;
  payer: string;
  amount: number;
  wallet: string;
  chain: string;
  status: "pending" | "sent";
  tx: string;
  timestamp: number;
};
type HouseDeposit = {
  id: string;
  source: "auction" | "escrow";
  source_id: string;
  gross: number;
  amount: number;
  wallet: string;
  timestamp: number;
};
type Bid = { id: string; bidder: string; amount: number; timestamp: number };
type Listing = {
  id: string;
  seller: string;
  title: string;
  description: string;
  category: string;
  image: string | null;
  start_price: number;
  buy_now: number | null;
  ends_at: number;
  created_at: number;
  status: "live" | "sold" | "ended" | "cancelled";
  winner: string | null;
  sold_price: number | null;
  house_fee?: number;
  bids: Bid[];
  watchers: string[];
};

const ROOM_CLEAR_MS = 48 * 60 * 60 * 1000;

const HOUSE_CUT = 0.03;

function creditHouse(source: "auction" | "escrow", sourceId: string, gross: number, payer = "") {
  ensureHouseWallet();
  if (!Array.isArray(db.houseDeposits)) db.houseDeposits = [];
  if (!Array.isArray(db.chainPayments)) db.chainPayments = [];
  const existing = db.houseDeposits.find((row) => row.source === source && row.source_id === sourceId);
  if (existing) return existing.amount;
  const amount = Math.round(Number(gross) * HOUSE_CUT * 1e8) / 1e8;
  if (!(amount > 0)) return 0;
  const wallet = (db.houseSettings?.feeWallet || "").trim();
  const chain = db.houseSettings?.chain || "base";
  db.houseDeposits.unshift({
    id: "fee" + nid(),
    source,
    source_id: sourceId,
    gross: Number(gross),
    amount,
    wallet,
    timestamp: Date.now(),
  });
  if (isBtcAddress(wallet)) {
    db.chainPayments.unshift({
      id: "pay" + nid(),
      source,
      source_id: sourceId,
      payer,
      amount,
      wallet,
      chain,
      status: "pending",
      tx: "",
      timestamp: Date.now(),
    });
  }
  return amount;
}

function ensureHouseWallet() {
  const previous = (db.houseSettings?.feeWallet || "").trim();
  if (!db.houseWallet?.key && !db.houseWallet?.phrase) {
    db.houseWallet = createHouseWallet();
  } else if (db.houseWallet) {
    db.houseWallet = asBitcoinWallet(db.houseWallet);
  }
  if (!db.houseWallet) db.houseWallet = createHouseWallet();
  if (!Array.isArray(db.payoutWallets)) db.payoutWallets = [];
  if (isBtcAddress(previous) && previous.toLowerCase() !== db.houseWallet.address.toLowerCase()) {
    if (!db.payoutWallets.some((item) => item.toLowerCase() === previous.toLowerCase())) db.payoutWallets.push(previous);
  }
  db.houseSettings.feeWallet = db.houseWallet.address;
  db.houseSettings.holdingWallet = db.houseWallet.address;
  for (const row of db.chainPayments || []) {
    if (row.status === "pending") row.wallet = db.houseWallet.address;
  }
  return db.houseWallet;
}

function isHouseAdmin(handle: string) {
  const name = handle.trim().toLowerCase();
  if (!name) return false;
  if (name === "flint") return true;
  const user = db.users.find((item) => item.handle.toLowerCase() === name);
  return (user?.role || "") === "admin";
}

function publicHouse() {
  const wallet = ensureHouseWallet();
  return {
    ...db.houseSettings,
    feeWallet: wallet.address,
    houseAddress: wallet.address,
    payouts: db.payoutWallets || [],
    deposits: db.houseDeposits || [],
    payments: db.chainPayments || [],
  };
}

function highBid(lot: Listing) {
  return lot.bids.reduce((top, bid) => (bid.amount > top ? bid.amount : top), 0);
}

function nextBid(lot: Listing) {
  const current = highBid(lot) || lot.start_price;
  const step = current < 0.001 ? 0.00001 : current < 0.01 ? 0.0001 : current < 0.1 ? 0.001 : 0.01;
  return (lot.bids.length ? current : lot.start_price) + (lot.bids.length ? step : 0);
}

function settleLot(lot: Listing) {
  if (lot.status !== "live" || Date.now() < lot.ends_at) return false;
  const top = [...lot.bids].sort((a, b) => b.amount - a.amount || a.timestamp - b.timestamp)[0];
  if (top) {
    lot.status = "sold";
    lot.winner = top.bidder;
    lot.sold_price = top.amount;
    lot.house_fee = creditHouse("auction", lot.id, top.amount, top.bidder);
  } else {
    lot.status = "ended";
    lot.winner = null;
    lot.sold_price = null;
  }
  return true;
}

function stripDemo() {
  const demoLots = new Set(["lot-coin", "lot-letter", "lot-ring"]);
  const posts = db.posts.length;
  const lots = (db.listings || []).length;
  db.posts = db.posts.filter((post) => post.id !== "p-seed");
  db.listings = (db.listings || []).filter((lot) => !demoLots.has(lot.id));
  if (Array.isArray(db.houseDeposits)) {
    db.houseDeposits = db.houseDeposits.filter((row) => !(row.source === "auction" && demoLots.has(row.source_id)));
  }
  if (!Array.isArray(db.removedRooms)) db.removedRooms = [];
  const stock = db.chatRooms.some((room) => room.id === "room-seed");
  const unmarked = !db.removedRooms.includes("room-seed");
  if (stock || unmarked) {
    db.chatRooms = db.chatRooms.filter((room) => room.id !== "room-seed");
    db.roomMessages = db.roomMessages.filter((msg) => msg.room_id !== "room-seed");
    if (unmarked) db.removedRooms.push("room-seed");
  }
  return db.posts.length !== posts || db.listings.length !== lots || stock || unmarked;
}

function touchMarket() {
  if (!Array.isArray(db.listings)) db.listings = [];
  const changed = db.listings.some((lot) => settleLot(lot));
  if (changed) save();
}

function defaultPolicy(): Policy {
  return {
    lockdown: false,
    torOnly: false,
    ghost: false,
    forwardSecrecy: false,
    burnDefault: false,
    notifications: true,
    sound: false,
    intercept: false,
    keyRotation: false,
    contentFilter: false,
    suspendEnabled: false,
    announcements: false,
    userReports: false,
    modCanFilter: true,
    modCanReports: true,
    modCanAnnounce: false,
    modCanSuspend: false,
    autoSweep: false,
    lastRotation: 0,
    lastSweep: 0,
  };
}

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
    posts: [],
    smsMessages: [],
    userSettings: {
      vesper: { avatar: "/avatars/tarot-tower.jpg" },
      ghost: { avatar: "/avatars/zodiac-scorpio.jpg" },
    },
    escrows: [],
    chatRooms: [],
    roomMessages: [],
    roomClearedAt: now,
    houseSettings: { holdingWallet: "", feeWallet: "", houseFeePercent: 3, chain: "bitcoin" },
    houseDeposits: [],
    chainPayments: [],
    houseWallet: null,
    payoutWallets: [],
    publicKeys: {},
    userKeys: {},
    listings: [],
    captures: [],
    wipes: [],
    policy: defaultPolicy(),
    interceptLog: [],
    reports: [],
    removedRooms: ["room-seed"],
  };
}

let seq = 10;
function sats(value: number) {
  return Math.round(value * 1e8) / 1e8;
}

async function convertDollarBooks() {
  if (db.moneyUnit === "btc") return;
  const hasMoney = db.listings.length || db.escrows.length || db.houseDeposits.length || db.chainPayments.length;
  if (!hasMoney) {
    db.moneyUnit = "btc";
    return;
  }
  const price = await spotUsd().catch(() => 0);
  if (!(price > 0)) return;
  const toBtc = (value: unknown) => sats(Number(value) / price);
  for (const lot of db.listings) {
    lot.start_price = toBtc(lot.start_price);
    lot.buy_now = lot.buy_now === null ? null : toBtc(lot.buy_now);
    lot.sold_price = lot.sold_price === null ? null : toBtc(lot.sold_price);
    if (lot.house_fee) lot.house_fee = toBtc(lot.house_fee);
    for (const bid of lot.bids) bid.amount = toBtc(bid.amount);
  }
  for (const row of db.escrows) {
    row.amount = toBtc(row.amount);
    if (row.house_fee !== undefined) row.house_fee = toBtc(row.house_fee);
    if (row.net_amount !== undefined) row.net_amount = toBtc(row.net_amount);
  }
  for (const row of db.houseDeposits) {
    row.gross = toBtc(row.gross);
    row.amount = toBtc(row.amount);
  }
  for (const row of db.chainPayments) row.amount = toBtc(row.amount);
  db.moneyUnit = "btc";
}

function bumpReveal(row: { emoji_encrypted?: number; is_burned?: number; content?: string; reveals?: Record<string, number> } | undefined, handle: string) {
  const name = handle.trim().toLowerCase();
  if (!row || row.emoji_encrypted !== 1 || row.is_burned || !name) return { count: 0, burned: false };
  const reveals = row.reveals && typeof row.reveals === "object" ? row.reveals : {};
  const count = Number(reveals[name] || 0) + 1;
  reveals[name] = count;
  row.reveals = reveals;
  const burned = count >= 2;
  if (burned) {
    row.is_burned = 1;
    row.content = "// BURNED //";
    row.emoji_encrypted = 0;
  }
  save();
  return { count, burned };
}

function noteCapture(handle: string, kind: "screenshot" | "recording", roomId?: string) {
  const name = handle.trim();
  if (!name) return null;
  const now = Date.now();
  const recent = db.captures.find((row) => sameHandle(row.handle, name) && row.kind === kind && now - row.timestamp < 3000);
  if (recent) return recent;
  const row = { id: "cap" + nid(), handle: name, kind, timestamp: now };
  db.captures.push(row);
  const text = name + (kind === "recording" ? " started a screen recording." : " took a screenshot.");
  const notice = {
    id: nid(),
    sender_handle: "notice",
    content: text,
    timestamp: now,
    emoji_encrypted: 0,
    system: 1,
  };
  db.openChatMessages.push(notice);
  if (roomId && roomId !== "general") {
    db.roomMessages.push({ ...notice, room_id: roomId });
  }
  save();
  return row;
}

function nid() {
  seq += 1;
  return Date.now() + seq;
}

async function ensureUserKey(handle: string) {
  const name = handle.trim();
  if (!name) throw new Error("Missing handle");
  if (!db.userKeys) db.userKeys = {};
  const found = Object.keys(db.userKeys).find((key) => key.toLowerCase() === name.toLowerCase());
  if (found) {
    db.publicKeys[found] = db.userKeys[found].publicKey;
    return { handle: found, ...db.userKeys[found] };
  }
  const pair = await generateKeyPair();
  const publicKey = await exportPublicKey(pair.publicKey);
  const privateKey = await exportPrivateKey(pair.privateKey);
  db.userKeys[name] = { publicKey, privateKey };
  db.publicKeys[name] = publicKey;
  return { handle: name, publicKey, privateKey };
}

async function sealBetween(sender: string, recipient: string, plaintext: string, reply = "") {
  const mine = await ensureUserKey(sender);
  const theirs = await ensureUserKey(recipient);
  const payload = await encryptMessage(
    JSON.stringify({ body: plaintext, reply }),
    await importPrivateKey(mine.privateKey),
    mine.publicKey,
    await importPublicKey(theirs.publicKey),
  );
  return JSON.stringify(payload);
}

async function sealPlainPrivate() {
  let changed = false;
  for (const msg of db.messages) {
    if (msg.e2e_encrypted || msg.is_burned || msg.sender_handle === "notice") continue;
    const conv = db.conversations.find((item) => item.id === msg.conversation_id);
    if (!conv) continue;
    const other = sameHandle(conv.user1_handle, msg.sender_handle) ? conv.user2_handle : conv.user1_handle;
    msg.content = await sealBetween(msg.sender_handle, other, msg.content, msg.reply_content || "");
    msg.reply_content = null;
    msg.e2e_encrypted = 1;
    changed = true;
  }
  for (const msg of db.smsMessages) {
    if (msg.e2e_encrypted || msg.is_burned || !msg.sender_handle || !msg.recipient) continue;
    msg.content = await sealBetween(String(msg.sender_handle), String(msg.recipient), String(msg.content || ""));
    msg.e2e_encrypted = 1;
    changed = true;
  }
  if (changed) save();
}

let db: Db = emptyDb();
let loaded = false;
let loading: Promise<void> | null = null;
let lastSaved = "";

function ensureLoaded() {
  if (loaded) return Promise.resolve();
  if (!loading) loading = loadAsync();
  return loading;
}

async function loadAsync() {
  if (typeof localStorage === "undefined") {
    loaded = true;
    return;
  }
  try {
    const raw = await readBlob();
    if (raw) {
      const json = isSealed(raw) ? await openVault(raw) : raw;
      const parsed = JSON.parse(json);
      db = { ...emptyDb(), ...parsed };
      if (!parsed.moneyUnit) db.moneyUnit = undefined;
      db.houseSettings = { ...emptyDb().houseSettings, ...db.houseSettings, houseFeePercent: 3, chain: "bitcoin" };
      if (!Array.isArray(db.houseDeposits)) db.houseDeposits = [];
      if (!Array.isArray(db.chainPayments)) db.chainPayments = [];
      if (!db.userKeys) db.userKeys = {};
      if (!Array.isArray(db.wipes)) db.wipes = [];
      db.policy = { ...defaultPolicy(), ...(db.policy || {}) };
      if (!Array.isArray(db.interceptLog)) db.interceptLog = [];
      if (!Array.isArray(db.reports)) db.reports = [];
      if (!Array.isArray(db.removedRooms)) db.removedRooms = [];
      const hadKey = Boolean(db.houseWallet?.key);
      ensureHouseWallet();
      const stripped = stripDemo();
      const wasDollars = db.moneyUnit !== "btc";
      await convertDollarBooks();
      if (!isSealed(raw) || stripped || !hadKey || (wasDollars && db.moneyUnit === "btc")) {
        lastSaved = "";
        save();
      } else {
        lastSaved = JSON.stringify(db);
      }
    } else {
      db.moneyUnit = "btc";
    }
  } catch {
    db = emptyDb();
    db.moneyUnit = "btc";
  }
  try { await sealPlainPrivate(); } catch { /* leave an unreadable private message sealed on the next open */ }
  try { await sealLockedRooms(); } catch { /* a locked room can be sealed on the next open */ }
  loaded = true;
  startBoard();
}

function publicSnapshot(): PublicBoard {
  const gone = new Set(db.removedRooms || []);
  const unlocked = new Set(db.chatRooms.filter((room) => !room.is_locked && !gone.has(room.id)).map((room) => room.id));
  const light = (value: unknown) => (typeof value === "string" && (value.startsWith("data:") || value.length > 400) ? null : value);
  return {
    posts: db.posts.filter((post) => !post.is_burned).slice(0, 40).map((post) => ({ ...post, author_avatar: light(post.author_avatar) as string | null })),
    chat: db.openChatMessages.filter((msg) => Number(msg.timestamp) >= (db.roomClearedAt || 0)).slice(-80),
    rooms: db.chatRooms.filter((room) => !gone.has(room.id)).map(({ password: _password, ...room }) => room),
    roomMessages: db.roomMessages.filter((msg) => unlocked.has(String(msg.room_id)) && Number(msg.timestamp) >= (db.roomClearedAt || 0)).slice(-80),
    lots: db.listings.slice(0, 40).map((lot) => ({ ...lot, image: light(lot.image) as string | null })),
    captures: (db.captures || []).slice(-40),
    wipes: db.wipes || [],
    removedRooms: db.removedRooms || [],
  };
}

function mergeBoard(remote: PublicBoard) {
  let changed = false;
  for (const wipe of remote.wipes || []) {
    const handle = String(wipe.handle || "");
    const at = Number(wipe.at) || 0;
    if (!handle || !at) continue;
    const prior = (db.wipes || []).find((row) => sameHandle(row.handle, handle));
    if (prior && prior.at >= at) continue;
    eraseUser(handle, at);
    changed = true;
  }
  const add = (list: Array<{ id?: unknown }>, row: { id?: unknown }) => {
    if (!row || row.id === undefined || list.some((item) => String(item.id) === String(row.id))) return;
    list.push(row);
    changed = true;
  };
  for (const post of remote.posts || []) {
    if (!post.id || !post.author_handle || typeof post.content !== "string" || wiped(post.author_handle, post.timestamp)) continue;
    add(db.posts, post as Post);
  }
  for (const msg of remote.chat || []) {
    if (Number(msg.timestamp) < (db.roomClearedAt || 0) || wiped(msg.sender_handle, msg.timestamp)) continue;
    add(db.openChatMessages, msg);
  }
  for (const id of remote.removedRooms || []) {
    const roomId = String(id || "");
    if (!roomId) continue;
    if (!db.removedRooms.includes(roomId)) {
      db.removedRooms.push(roomId);
      changed = true;
    }
    if (db.chatRooms.some((room) => room.id === roomId) || db.roomMessages.some((msg) => msg.room_id === roomId)) {
      db.chatRooms = db.chatRooms.filter((room) => room.id !== roomId);
      db.roomMessages = db.roomMessages.filter((msg) => msg.room_id !== roomId);
      changed = true;
    }
  }
  for (const room of remote.rooms || []) {
    if (!room.id || db.removedRooms.includes(String(room.id)) || wiped(room.creator_handle, room.created_at) || db.chatRooms.some((item) => item.id === String(room.id))) continue;
    const { password: _password, ...rest } = room as Room;
    db.chatRooms.push({ ...rest, password: null });
    changed = true;
  }
  const unlocked = new Set(db.chatRooms.filter((room) => !room.is_locked).map((room) => room.id));
  for (const msg of remote.roomMessages || []) {
    if (!unlocked.has(String(msg.room_id)) || Number(msg.timestamp) < (db.roomClearedAt || 0) || wiped(msg.sender_handle, msg.timestamp)) continue;
    add(db.roomMessages, msg);
  }
  for (const lot of remote.lots || []) {
    const incoming = lot as Listing;
    if (wiped(incoming.seller, incoming.created_at)) continue;
    const local = db.listings.find((item) => item.id === incoming.id);
    if (!local) {
      db.listings.push({
        ...incoming,
        bids: (incoming.bids || []).filter((bid) => !wiped(bid.bidder, bid.timestamp)),
        watchers: (incoming.watchers || []).filter((name) => !wiped(name, incoming.created_at)),
      });
      changed = true;
      continue;
    }
    for (const bid of incoming.bids || []) {
      if (wiped(bid.bidder, bid.timestamp)) continue;
      if (!local.bids.some((item) => item.id === bid.id)) {
        local.bids.push(bid);
        changed = true;
      }
    }
    if (local.status === "live" && incoming.status && incoming.status !== "live") {
      local.status = incoming.status;
      local.winner = incoming.winner;
      local.sold_price = incoming.sold_price;
      local.house_fee = incoming.house_fee;
      changed = true;
    }
  }
  for (const row of remote.captures || []) add(db.captures, row as Db["captures"][number]);
  return changed;
}

let boardStarted = false;
function startBoard() {
  if (boardStarted || typeof WebSocket === "undefined") return;
  boardStarted = true;
  const tick = async () => {
    try {
      const remote = await exchangeBoard(publicSnapshot());
      let changed = false;
      for (const board of remote) if (mergeBoard(board)) changed = true;
      if (changed) save();
    } catch { /* a relay can be down */ }
  };
  void tick();
  window.setInterval(() => { void tick(); }, 8000);
}

async function readBlob() {
  try {
    const stored = await vaultGet("db");
    if (stored) return stored;
  } catch {
    /* IndexedDB unavailable, use the old slot */
  }
  const legacy = localStorage.getItem(KEY);
  if (!legacy) return null;
  try {
    await vaultSet("db", legacy);
    localStorage.removeItem(KEY);
  } catch {
    /* leave the old copy in place */
  }
  return legacy;
}

async function writeBlob(sealed: string) {
  try {
    await vaultSet("db", sealed);
    localStorage.removeItem(KEY);
  } catch {
    localStorage.setItem(KEY, sealed);
  }
}

function save() {
  try {
    const next = JSON.stringify(db);
    if (next === lastSaved) return;
    const previous = lastSaved;
    lastSaved = next;
    void sealVault(next).then((sealed) => writeBlob(sealed)).then(() => {
      if (typeof window !== "undefined") window.dispatchEvent(new Event("omerta-live"));
    }).catch(() => {
      lastSaved = previous;
    });
  } catch {
    /* memory copy still stands */
  }
}

export async function grantLocalRole(handle: string, role: "admin" | "moderator" | "basic", passphrase?: string) {
  await ensureLoaded();
  const name = handle.trim();
  if (!name) return;
  const existing = db.users.find((u) => u.handle.toLowerCase() === name.toLowerCase());
  if (existing) {
    existing.role = role;
    if (passphrase) existing.passphrase = passphrase;
  } else {
    db.users.push({
      id: nid(),
      handle: name,
      passphrase: passphrase || "session-" + nid(),
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

function sameHandle(a: unknown, b: unknown) {
  return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

function wiped(handle: unknown, when: unknown) {
  const at = Number(when) || 0;
  return (db.wipes || []).some((row) => sameHandle(row.handle, handle) && at <= row.at);
}

function eraseUser(handle: string, at: number) {
  if (!handle) return;
  if (!Array.isArray(db.wipes)) db.wipes = [];
  const prior = db.wipes.find((row) => sameHandle(row.handle, handle));
  if (prior) prior.at = Math.max(prior.at, at);
  else db.wipes.push({ handle, at });
  db.posts = db.posts.filter((post) => !((sameHandle(post.author, handle) || sameHandle(post.author_handle, handle)) && post.timestamp <= at));
  db.listings = db.listings.filter((lot) => !(sameHandle(lot.seller, handle) && lot.created_at <= at));
  for (const lot of db.listings) {
    lot.bids = (lot.bids || []).filter((bid) => !(sameHandle(bid.bidder, handle) && bid.timestamp <= at));
    lot.watchers = (lot.watchers || []).filter((name) => !sameHandle(name, handle));
    if (sameHandle(lot.winner, handle) && (lot.ends_at || 0) <= at) lot.winner = null;
  }
  db.messages = db.messages.filter((msg) => !(sameHandle(msg.sender_handle, handle) && msg.timestamp <= at));
  db.conversations = db.conversations.filter((conv) => db.messages.some((msg) => msg.conversation_id === conv.id) || (!sameHandle(conv.user1_handle, handle) && !sameHandle(conv.user2_handle, handle)));
  db.openChatMessages = db.openChatMessages.filter((msg) => msg.sender_handle === "notice" || !(sameHandle(msg.sender_handle, handle) && Number(msg.timestamp) <= at));
  db.roomMessages = db.roomMessages.filter((msg) => !(sameHandle(msg.sender_handle, handle) && Number(msg.timestamp) <= at));
  const ownRooms = db.chatRooms.filter((room) => sameHandle(room.creator_handle, handle) && room.created_at <= at).map((room) => room.id);
  db.chatRooms = db.chatRooms.filter((room) => !ownRooms.includes(room.id));
  db.roomMessages = db.roomMessages.filter((msg) => !ownRooms.includes(String(msg.room_id)));
  db.smsMessages = db.smsMessages.filter((msg) => !((sameHandle(msg.sender_handle, handle) || sameHandle(msg.recipient, handle)) && Number(msg.timestamp) <= at));
  db.escrows = db.escrows.filter((row) => !((sameHandle(row.sender, handle) || sameHandle(row.recipient, handle)) && Number(row.created_at) <= at));
  db.captures = (db.captures || []).filter((row) => !(sameHandle(row.handle, handle) && row.timestamp <= at));
  for (const key of Object.keys(db.userSettings || {})) {
    if (!sameHandle(key, handle)) continue;
    const current = db.userSettings[key] || {};
    db.userSettings[key] = {
      wipeEnabled: current.wipeEnabled,
      wipeDays: current.wipeDays,
      wipeAt: current.wipeAt,
      updated_at: at,
    };
  }
}

function denySend(handle: string) {
  const user = db.users.find((item) => sameHandle(item.handle, handle));
  if (db.policy?.suspendEnabled && user?.suspended) return "This handle is suspended";
  if (db.policy?.lockdown && user?.role !== "admin") return "The house is locked down";
  return "";
}

function guard(handle: string, text = "") {
  const reason = denySend(handle) || heldByFilter(text);
  if (reason) return json({ error: reason }, 403);
  noteTraffic(handle, "send", String(text || "").length);
  return null;
}

function heldByFilter(text: string) {
  if (!db.policy?.contentFilter) return "";
  const links = String(text || "").match(/https?:\/\//gi) || [];
  if (links.length >= 4) return "That message was held by the content filter";
  return "";
}

function noteTraffic(handle: string, kind: string, bytes: number) {
  if (!db.policy?.intercept) return;
  if (!Array.isArray(db.interceptLog)) db.interceptLog = [];
  db.interceptLog.push({ t: Date.now(), handle, kind, bytes });
  if (db.interceptLog.length > 200) db.interceptLog.splice(0, db.interceptLog.length - 200);
}

function vaultIdsIn(text: unknown, into: Set<string>) {
  for (const match of String(text || "").matchAll(/vault:([A-Za-z0-9]+)/g)) into.add(match[1]);
}

async function dropOwnedFiles(handle: string, at: number) {
  const ids = new Set<string>();
  const mine = Object.entries(db.userKeys || {}).find(([key]) => sameHandle(key, handle))?.[1];
  for (const post of db.posts) {
    if ((sameHandle(post.author, handle) || sameHandle(post.author_handle, handle)) && post.timestamp <= at) vaultIdsIn(post.content, ids);
  }
  for (const lot of db.listings) {
    if (sameHandle(lot.seller, handle) && lot.created_at <= at) vaultIdsIn(lot.image, ids);
  }
  const rows = [
    ...db.messages.filter((msg) => sameHandle(msg.sender_handle, handle) && msg.timestamp <= at),
    ...db.openChatMessages.filter((msg) => sameHandle(msg.sender_handle, handle) && Number(msg.timestamp) <= at),
    ...db.roomMessages.filter((msg) => sameHandle(msg.sender_handle, handle) && Number(msg.timestamp) <= at),
    ...db.smsMessages.filter((msg) => sameHandle(msg.sender_handle, handle) && Number(msg.timestamp) <= at),
  ];
  for (const msg of rows) {
    if (msg.e2e_encrypted && mine?.privateKey) {
      try {
        const opened = await openPrivate(JSON.parse(String(msg.content || "")), await importPrivateKey(mine.privateKey), mine.publicKey);
        vaultIdsIn(opened.body, ids);
        vaultIdsIn(opened.reply, ids);
        continue;
      } catch { /* a sealed file stays if this key cannot open it */ }
    }
    vaultIdsIn(msg.content, ids);
  }
  for (const id of ids) {
    try { await deleteVaultFile(id); } catch { /* the record may already be gone */ }
  }
}

async function rotateHandle(handle: string) {
  const key = Object.keys(db.userKeys || {}).find((item) => sameHandle(item, handle));
  if (!key) return;
  const current = db.userKeys[key];
  const history = Array.isArray(current.history) ? current.history : [];
  history.push({ publicKey: current.publicKey, privateKey: current.privateKey });
  const pair = await generateKeyPair();
  current.history = history.slice(-6);
  current.publicKey = await exportPublicKey(pair.publicKey);
  current.privateKey = await exportPrivateKey(pair.privateKey);
  db.publicKeys[key] = current.publicKey;
}

async function maybeRotate() {
  if (!db.policy?.keyRotation || Date.now() - Number(db.policy.lastRotation || 0) < 6 * 60 * 60 * 1000) return;
  for (const handle of Object.keys(db.userKeys || {})) await rotateHandle(handle);
  db.policy.lastRotation = Date.now();
  save();
}

async function maybeSweep() {
  if (!db.policy?.autoSweep || Date.now() - Number(db.policy.lastSweep || 0) < 60 * 60 * 1000) return;
  db.policy.lastSweep = Date.now();
  const to = db.houseSettings.feeWallet || db.houseSettings.holdingWallet;
  const key = db.houseWallet?.key;
  save();
  if (!to || !key || !isBtcAddress(to)) return;
  try { await exportHouseBtc(key, to); } catch { /* the coins stay in the house wallet */ }
}

async function sealLockedRooms() {
  let changed = false;
  for (const room of db.chatRooms) {
    if (!room.is_locked || !room.password) continue;
    const key = await roomKeyFromPassphrase(room.password, room.id);
    for (const msg of db.roomMessages) {
      if (msg.room_id !== room.id || msg.e2e_encrypted || msg.sender_handle === "notice") continue;
      msg.content = JSON.stringify(await encryptForRoom(String(msg.content || ""), key));
      msg.e2e_encrypted = 1;
      changed = true;
    }
  }
  if (changed) save();
}

async function wipeIfDue() {
  const now = Date.now();
  let changed = false;
  for (const [handle, settings] of Object.entries(db.userSettings || {})) {
    if (!settings?.wipeEnabled || !settings.wipeAt || now < Number(settings.wipeAt)) continue;
    const days = Math.min(7, Math.max(1, Math.round(Number(settings.wipeDays) || 1)));
    await dropOwnedFiles(handle, now);
    eraseUser(handle, now);
    for (const key of Object.keys(db.userSettings)) {
      if (!sameHandle(key, handle)) continue;
      db.userSettings[key] = { wipeEnabled: true, wipeDays: days, wipeAt: now + days * 86400000, updated_at: now };
    }
    changed = true;
  }
  if (changed) save();
}

async function runSyn(command: string) {
  const [name, ...rest] = command.trim().split(/\s+/);
  const arg = rest.join(" ").trim();
  if (!name || name === "help") {
    return [
      "help                 show these house commands",
      "whoami               show the signed-in admin",
      "users                list handles and roles",
      "house                show the house wallet and books",
      "rooms                list rooms",
      "lockdown on|off      block every channel except the admin",
      "suspend <handle>     suspend a handle",
      "unsuspend <handle>   lift a suspension",
      "autosweep on|off     send house bitcoin to the saved payout address each hour",
      "sweep                send the house bitcoin now",
      "announce <text>      post a notice on the news board",
      "log                  show the encrypted traffic log",
      "clear                clear that log",
    ].join("\n");
  }
  if (name === "whoami") return "flint\nadmin\n";
  if (name === "users") return db.users.map((user) => user.handle + "  " + (user.role || "basic") + (user.suspended ? "  suspended" : "")).join("\n") + "\n";
  if (name === "house") {
    const wallet = db.houseWallet?.address || "none";
    const payout = db.houseSettings.feeWallet || db.houseSettings.holdingWallet || "none";
    const book = (db.houseDeposits || []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    return "wallet " + wallet + "\npayout " + payout + "\nauto sweep " + (db.policy?.autoSweep ? "on" : "off") + "\nbook " + book.toFixed(8) + " BTC\n";
  }
  if (name === "rooms") return db.chatRooms.map((room) => (room.is_locked ? "locked  " : "open    ") + room.name).join("\n") + "\n";
  if (name === "lockdown") {
    db.policy.lockdown = arg === "on";
    save();
    return "lockdown " + (db.policy.lockdown ? "on" : "off") + "\n";
  }
  if (name === "autosweep") {
    db.policy.autoSweep = arg === "on";
    save();
    return "auto sweep " + (db.policy.autoSweep ? "on" : "off") + "\n";
  }
  if (name === "suspend" || name === "unsuspend") {
    const user = db.users.find((item) => sameHandle(item.handle, arg));
    if (!user) return "No such handle\n";
    user.suspended = name === "suspend";
    db.policy.suspendEnabled = true;
    save();
    return user.handle + (user.suspended ? " suspended\n" : " restored\n");
  }
  if (name === "sweep") {
    const to = db.houseSettings.feeWallet || db.houseSettings.holdingWallet;
    if (!to || !db.houseWallet?.key) return "Set a payout address first\n";
    try {
      const tx = await exportHouseBtc(db.houseWallet.key, to);
      return "sent " + tx + "\n";
    } catch (err) {
      return (err instanceof Error ? err.message : "The sweep did not send") + "\n";
    }
  }
  if (name === "announce") {
    if (!arg) return "Write the announcement after the command\n";
    db.posts.unshift({
      id: "p" + nid(),
      author: "Flint",
      author_handle: "flint",
      author_avatar: null,
      content: arg,
      emoji_encrypted: 0,
      timestamp: Date.now(),
      likes: 0,
      dislikes: 0,
      comments: 0,
      shares: 0,
      is_burned: 0,
      burn_after: 0,
      replies: [],
      liked_by: [],
      disliked_by: [],
    });
    save();
    return "posted\n";
  }
  if (name === "log") {
    return (db.interceptLog || []).slice(-30).map((row) => new Date(row.t).toISOString() + "  " + row.handle + "  " + row.kind + "  " + row.bytes).join("\n") + "\n";
  }
  if (name === "clear") {
    db.interceptLog = [];
    save();
    return "log cleared\n";
  }
  return "Unknown command. Type help.\n";
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
  await ensureLoaded();
  clearRoomsIfDue();
  await wipeIfDue();
  await maybeRotate();
  await maybeSweep();
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
    await ensureUserKey(user.handle);
    save();
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
    const role = "basic";
    const user: User = { id: nid(), handle, passphrase, role, created_at: Math.floor(Date.now() / 1000) };
    db.users.push(user);
    await ensureUserKey(user.handle);
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
    const user = db.users.find((u) => u.handle.toLowerCase() === handle.toLowerCase());
    if (!user) return json({ error: "Not found" }, 404);
    const settings = db.userSettings[user.handle] || db.userSettings[handle] || {};
    let avatar = (settings.avatar as string) || null;
    if (!avatar) {
      const post = [...db.posts].reverse().find((p) => p.author_handle.toLowerCase() === user.handle.toLowerCase() && p.author_avatar);
      avatar = post?.author_avatar || null;
    }
    return json({ handle: user.handle, created_at: user.created_at, role: user.role || "basic", avatar });
  }

  if (seg[0] === "users" && seg[2] === "promote" && method === "POST") {
    const { role, adminHandle } = await readJson(input, init);
    const admin = db.users.find((u) => u.handle.toLowerCase() === String(adminHandle || "").toLowerCase());
    if (!admin || admin.role !== "admin") return json({ error: "Admin only" }, 403);
    const user = db.users.find((u) => u.handle.toLowerCase() === decodeURIComponent(seg[1]).toLowerCase());
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
    delete body.wipeAt;
    const prev = db.userSettings[handle] || {};
    const next = { ...prev, ...body, updated_at: Date.now() };
    if (body.wipeEnabled !== undefined || body.wipeDays !== undefined) {
      const enabled = Boolean(body.wipeEnabled !== undefined ? body.wipeEnabled : prev.wipeEnabled);
      const days = Math.min(7, Math.max(1, Math.round(Number(body.wipeDays !== undefined ? body.wipeDays : prev.wipeDays) || 1)));
      const changed = enabled !== Boolean(prev.wipeEnabled) || days !== Number(prev.wipeDays);
      next.wipeEnabled = enabled;
      next.wipeDays = days;
      next.wipeAt = enabled ? (changed || !prev.wipeAt ? Date.now() + days * 86400000 : Number(prev.wipeAt)) : 0;
    }
    db.userSettings[handle] = next;
    save();
    return json({ success: true, wipeEnabled: Boolean(next.wipeEnabled), wipeDays: Number(next.wipeDays) || 1, wipeAt: Number(next.wipeAt) || 0 });
  }

  if (seg[0] === "policy" && method === "GET") {
    return json(db.policy || defaultPolicy());
  }

  if (seg[0] === "policy" && method === "POST") {
    const body = await readJson(input, init);
    const user = db.users.find((item) => sameHandle(item.handle, body.handle));
    const admin = user?.role === "admin";
    const mod = admin || user?.role === "moderator";
    const next = { ...defaultPolicy(), ...(db.policy || {}) };
    if (body.burnDefault !== undefined) next.burnDefault = Boolean(body.burnDefault);
    if (body.notifications !== undefined) next.notifications = Boolean(body.notifications);
    if (body.sound !== undefined) next.sound = Boolean(body.sound);
    if (body.torOnly !== undefined) next.torOnly = Boolean(body.torOnly);
    if (body.forwardSecrecy !== undefined) next.forwardSecrecy = Boolean(body.forwardSecrecy);
    if (admin && body.ghost !== undefined) next.ghost = Boolean(body.ghost);
    if (admin && body.lockdown !== undefined) next.lockdown = Boolean(body.lockdown);
    if (admin && body.intercept !== undefined) next.intercept = Boolean(body.intercept);
    if (admin && body.keyRotation !== undefined) next.keyRotation = Boolean(body.keyRotation);
    if (admin && body.autoSweep !== undefined) next.autoSweep = Boolean(body.autoSweep);
    if (mod && body.contentFilter !== undefined && (admin || next.modCanFilter)) next.contentFilter = Boolean(body.contentFilter);
    if (mod && body.suspendEnabled !== undefined && (admin || next.modCanSuspend)) next.suspendEnabled = Boolean(body.suspendEnabled);
    if (body.announcements !== undefined && (admin || (mod && next.modCanAnnounce))) next.announcements = Boolean(body.announcements);
    if (body.userReports !== undefined && (admin || (mod && next.modCanReports))) next.userReports = Boolean(body.userReports);
    if (admin && body.modCanFilter !== undefined) next.modCanFilter = Boolean(body.modCanFilter);
    if (admin && body.modCanReports !== undefined) next.modCanReports = Boolean(body.modCanReports);
    if (admin && body.modCanAnnounce !== undefined) next.modCanAnnounce = Boolean(body.modCanAnnounce);
    if (admin && body.modCanSuspend !== undefined) next.modCanSuspend = Boolean(body.modCanSuspend);
    db.policy = next;
    try { localStorage.setItem("omerta_tor_only", next.torOnly ? "1" : "0"); localStorage.setItem("omerta_policy", JSON.stringify(next)); } catch { /* private mode */ }
    save();
    return json(next);
  }

  if (seg[0] === "session" && seg[1] === "end" && method === "POST") {
    const body = await readJson(input, init);
    const handle = String(body.handle || "");
    if (db.policy?.ghost) {
      for (const msg of db.messages) if (sameHandle(msg.sender_handle, handle)) { msg.is_burned = 1; msg.content = "// BURNED //"; msg.e2e_encrypted = 0; }
      for (const msg of db.openChatMessages) if (sameHandle(msg.sender_handle, handle)) { msg.content = "// BURNED //"; msg.emoji_encrypted = 0; }
      for (const msg of db.roomMessages) if (sameHandle(msg.sender_handle, handle)) { msg.content = "// BURNED //"; msg.emoji_encrypted = 0; msg.e2e_encrypted = 0; }
      for (const msg of db.smsMessages) if (sameHandle(msg.sender_handle, handle)) { msg.is_burned = 1; msg.content = "// BURNED //"; msg.e2e_encrypted = 0; }
    }
    if (db.policy?.forwardSecrecy) await rotateHandle(handle);
    save();
    return json({ success: true });
  }

  if (seg[0] === "reports" && method === "GET") {
    const handle = q.get("handle") || "";
    const user = db.users.find((item) => sameHandle(item.handle, handle));
    const allowed = user && (user.role === "admin" || (user.role === "moderator" && db.policy?.modCanReports && db.policy?.userReports));
    if (!allowed) return json({ error: "Denied" }, 403);
    return json(db.reports || []);
  }

  if (seg[0] === "reports" && method === "POST" && seg.length === 1) {
    const body = await readJson(input, init);
    const reporter = String(body.reporter || "").trim();
    const target = String(body.target || "").trim();
    const reason = String(body.reason || "").trim().slice(0, 280);
    if (!reporter || !target || !reason) return json({ error: "Say who and why" }, 400);
    const stopped = guard(reporter, reason);
    if (stopped) return stopped;
    const row = { id: "rep" + nid(), reporter, target, kind: String(body.kind || "post"), reason, ref: String(body.ref || ""), status: "open", timestamp: Date.now() };
    if (!Array.isArray(db.reports)) db.reports = [];
    db.reports.unshift(row);
    save();
    return json(row);
  }

  if (seg[0] === "reports" && seg[2] === "dismiss" && method === "POST") {
    const body = await readJson(input, init);
    const user = db.users.find((item) => sameHandle(item.handle, body.handle));
    if (!user || (user.role !== "admin" && user.role !== "moderator")) return json({ error: "Denied" }, 403);
    const row = (db.reports || []).find((item) => item.id === seg[1]);
    if (!row) return json({ error: "No such report" }, 404);
    row.status = "dismissed";
    save();
    return json(row);
  }

  if (seg[0] === "reports" && seg[2] === "suspend" && method === "POST") {
    const body = await readJson(input, init);
    const user = db.users.find((item) => sameHandle(item.handle, body.handle));
    const allowed = user && (user.role === "admin" || (user.role === "moderator" && db.policy?.modCanSuspend));
    if (!allowed) return json({ error: "Denied" }, 403);
    const row = (db.reports || []).find((item) => item.id === seg[1]);
    if (!row) return json({ error: "No such report" }, 404);
    const target = db.users.find((item) => sameHandle(item.handle, row.target));
    if (target) target.suspended = true;
    db.policy.suspendEnabled = true;
    row.status = "suspended";
    save();
    return json(row);
  }

  if (seg[0] === "announce" && method === "POST") {
    const body = await readJson(input, init);
    const user = db.users.find((item) => sameHandle(item.handle, body.handle));
    const allowed = user && (user.role === "admin" || (user.role === "moderator" && db.policy?.announcements && db.policy?.modCanAnnounce));
    if (!allowed) return json({ error: "Announcements are off" }, 403);
    const content = String(body.content || "").trim();
    if (!content) return json({ error: "Write the announcement" }, 400);
    const post: Post = {
      id: "p" + nid(),
      author: user.handle,
      author_handle: user.handle,
      author_avatar: null,
      content,
      emoji_encrypted: 0,
      timestamp: Date.now(),
      likes: 0,
      dislikes: 0,
      comments: 0,
      shares: 0,
      is_burned: 0,
      burn_after: 0,
      replies: [],
      liked_by: [],
      disliked_by: [],
    };
    (post as Post & { announcement?: number }).announcement = 1;
    db.posts.unshift(post);
    save();
    return json(post);
  }

  if (seg[0] === "conversations" && seg.length === 1 && method === "GET") {
    const handle = q.get("handle") || "";
    const rows = db.conversations
      .filter((c) => sameHandle(c.user1_handle, handle) || sameHandle(c.user2_handle, handle))
      .map((c) => {
        const msgs = db.messages.filter((m) => m.conversation_id === c.id).sort((a, b) => a.timestamp - b.timestamp);
        const last = msgs[msgs.length - 1];
        return {
          ...c,
          last_message: last?.e2e_encrypted ? "Encrypted message" : (last?.content || null),
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
    const handle = q.get("handle") || "";
    const conv = db.conversations.find((item) => item.id === id);
    if (!conv || (!sameHandle(conv.user1_handle, handle) && !sameHandle(conv.user2_handle, handle))) {
      return json({ error: "Private" }, 403);
    }
    return json(db.messages.filter((m) => m.conversation_id === id).sort((a, b) => a.timestamp - b.timestamp));
  }

  if (seg[0] === "conversations" && seg[2] === "messages" && method === "POST") {
    const body = await readJson(input, init);
    const conv = db.conversations.find((item) => item.id === Number(seg[1]));
    if (!conv) return json({ error: "No such conversation" }, 404);
    const sender = String(body.sender || "");
    const recipient = sameHandle(conv.user1_handle, sender) ? conv.user2_handle : conv.user1_handle;
    if (!sender || !recipient) return json({ error: "Missing handle" }, 400);
    const stopped = guard(sender, String(body.content || ""));
    if (stopped) return stopped;
    const msg: Msg = {
      id: nid(),
      conversation_id: conv.id,
      sender_handle: sender,
      content: await sealBetween(sender, recipient, String(body.content || ""), String(body.replyContent || "")),
      timestamp: Date.now(),
      burn_after_read: body.burnAfterRead ? 1 : 0,
      is_burned: 0,
      emoji_encrypted: body.emojiEncrypted ? 1 : 0,
      e2e_encrypted: 1,
      reply_to: body.replyTo ?? null,
      reply_content: null,
      reply_sender: body.replySender ?? null,
    };
    db.messages.push(msg);
    save();
    return json(msg);
  }

  if (seg[0] === "messages" && seg[2] === "reveal" && method === "POST") {
    const body = await readJson(input, init);
    const msg = db.messages.find((item) => item.id === Number(seg[1]));
    return json(bumpReveal(msg, String(body.handle || "")));
  }

  if (seg[0] === "reveal" && method === "POST") {
    const body = await readJson(input, init);
    const handle = String(body.handle || "");
    const id = String(body.id || "");
    const scope = String(body.scope || "");
    if (scope === "dm") return json(bumpReveal(db.messages.find((item) => item.id === Number(id)), handle));
    if (scope === "chat") return json(bumpReveal(db.openChatMessages.find((item) => String(item.id) === id) as { emoji_encrypted?: number; is_burned?: number; content?: string; reveals?: Record<string, number> }, handle));
    if (scope === "room") return json(bumpReveal(db.roomMessages.find((item) => String(item.id) === id) as { emoji_encrypted?: number; is_burned?: number; content?: string; reveals?: Record<string, number> }, handle));
    if (scope === "post") return json(bumpReveal(db.posts.find((item) => item.id === id), handle));
    return json({ count: 0, burned: false });
  }

  if (seg[0] === "captures" && method === "GET") {
    return json(db.captures.slice(-80));
  }

  if (seg[0] === "captures" && method === "POST") {
    const body = await readJson(input, init);
    const kind = body.kind === "recording" ? "recording" : "screenshot";
    const row = noteCapture(String(body.handle || ""), kind, String(body.room || ""));
    return json({ row, captures: db.captures.slice(-80) });
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
    const stopped = guard(String(body.sender || ""), String(body.content || ""));
    if (stopped) return stopped;
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
      .filter((m) => sameHandle(m.sender_handle, handle) || sameHandle(m.recipient, handle))
      .sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
    return json(rows);
  }

  if (seg[0] === "sms" && seg.length === 1 && method === "POST") {
    const body = await readJson(input, init);
    const sender = String(body.sender || "");
    const recipient = String(body.recipient || "");
    if (!sender || !recipient) return json({ error: "Missing handle" }, 400);
    const stopped = guard(sender, String(body.content || ""));
    if (stopped) return stopped;
    const msg = {
      id: nid(),
      sender_handle: sender,
      recipient,
      content: await sealBetween(sender, recipient, String(body.content || "")),
      timestamp: Date.now(),
      burn_after_read: body.burnAfterRead ? 1 : 0,
      is_burned: 0,
      e2e_encrypted: 1,
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
        try {
          const id = await storeVaultFile(await file.arrayBuffer(), file.type || (/\.mov$/i.test(file.name) ? "video/quicktime" : /\.(mp4|m4v)$/i.test(file.name) ? "video/mp4" : /\.webm$/i.test(file.name) ? "video/webm" : "application/octet-stream"));
          return json({ url: "vault:" + id, name: file.name });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Upload failed";
          return json({ error: message }, 413);
        }
      }
    }
    return json({ error: "No file" }, 400);
  }

  if (seg[0] === "house" && seg[1] === "settings" && method === "GET") {
    db.houseSettings.houseFeePercent = 3;
    const fresh = !db.houseWallet?.key;
    const body = publicHouse();
    if (fresh) save();
    return json(body);
  }
  if (seg[0] === "house" && seg[1] === "settings" && method === "POST") {
    const body = await readJson(input, init);
    const actor = String(body.actor || "").trim();
    if (!isHouseAdmin(actor)) return json({ error: "Only an admin can change the house wallet" }, 403);
    ensureHouseWallet();
    db.houseSettings.chain = "bitcoin";
    db.houseSettings.houseFeePercent = 3;
    const payout = String(body.payout || "").trim();
    if (payout) {
      if (!isBtcAddress(payout)) return json({ error: "That payout address is not a bitcoin address" }, 400);
      if (payout.toLowerCase() !== db.houseWallet!.address.toLowerCase() && !db.payoutWallets.some((item) => item.toLowerCase() === payout.toLowerCase())) {
        db.payoutWallets.push(payout);
      }
    }
    save();
    return json({ success: true, ...publicHouse() });
  }
  if (seg[0] === "house" && seg[1] === "export" && method === "POST") {
    const body = await readJson(input, init);
    const actor = String(body.actor || "").trim();
    if (!isHouseAdmin(actor)) return json({ error: "Only an admin can export" }, 403);
    const wallet = ensureHouseWallet();
    const to = String(body.to || "").trim();
    const amount = body.amount === undefined || body.amount === "" ? undefined : Number(body.amount);
    if (amount !== undefined && !Number.isFinite(amount)) return json({ error: "Enter an amount" }, 400);
    try {
      const tx = await exportHouseBtc(wallet.key, to, amount);
      save();
      return json({ success: true, tx });
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : "The export was refused" }, 400);
    }
  }
  if (seg[0] === "house" && seg[1] === "recovery" && method === "POST") {
    const body = await readJson(input, init);
    if (!isHouseAdmin(String(body.actor || ""))) return json({ error: "Only an admin can see the recovery phrase" }, 403);
    const wallet = ensureHouseWallet();
    save();
    return json({ phrase: wallet.phrase || "", key: wallet.phrase ? "" : wallet.key });
  }
  if (seg[0] === "house" && seg[1] === "restore" && method === "POST") {
    const body = await readJson(input, init);
    if (!isHouseAdmin(String(body.actor || ""))) return json({ error: "Only an admin can restore the house wallet" }, 403);
    try {
      const restored = restoreHouseWallet(String(body.secret || ""));
      db.houseWallet = restored;
      db.houseSettings.feeWallet = restored.address;
      db.houseSettings.holdingWallet = restored.address;
      save();
      return json({ success: true, address: restored.address });
    } catch {
      return json({ error: "That recovery phrase is not valid" }, 400);
    }
  }
  if (seg[0] === "house" && seg[1] === "payments" && seg[3] === "sent" && method === "POST") {
    const row = (db.chainPayments || []).find((item) => item.id === seg[2]);
    if (!row) return json({ error: "Not found" }, 404);
    const body = await readJson(input, init);
    row.status = "sent";
    row.tx = String(body.tx || "");
    save();
    return json(row);
  }

  if (seg[0] === "escrow" && seg[1] === "all" && method === "GET") {
    return json([...db.escrows].sort((a, b) => Number(b.created_at) - Number(a.created_at)));
  }

  if (seg[0] === "escrow" && seg.length === 1 && method === "GET") {
    const handle = q.get("handle") || "";
    return json(
      db.escrows
        .filter((e) => sameHandle(e.sender, handle) || sameHandle(e.recipient, handle))
        .sort((a, b) => Number(b.created_at) - Number(a.created_at)),
    );
  }

  if (seg[0] === "escrow" && seg.length === 1 && method === "POST") {
    const body = await readJson(input, init);
    const amount = Number(body.amount);
    if (!body.sender || !body.recipient || !Number.isFinite(amount) || amount <= 0) {
      return json({ error: "Enter a recipient and an amount" }, 400);
    }
    const stopped = guard(String(body.sender || ""));
    if (stopped) return stopped;
    const pct = 3;
    const houseFee = sats(amount * (pct / 100));
    const escrow = {
      id: "e" + nid(),
      sender: body.sender,
      recipient: body.recipient,
      amount,
      house_fee: houseFee,
      net_amount: sats(amount - houseFee),
      house_fee_percent: pct,
      description: body.description || "",
      status: "pending",
      created_at: Date.now(),
      resolved_at: null,
      resolved_by: null,
      resolution_note: null,
    };
    db.escrows.unshift(escrow);
    escrow.house_fee = creditHouse("escrow", String(escrow.id), amount, String(body.sender || ""));
    escrow.house_fee_percent = 3;
    escrow.net_amount = sats(amount - Number(escrow.house_fee));
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
    if (escrow.status === "released" || escrow.status === "refunded" || escrow.status === "cancelled") {
      escrow.house_fee = creditHouse("escrow", String(escrow.id), Number(escrow.amount), String(escrow.sender || ""));
      escrow.house_fee_percent = 3;
      escrow.net_amount = sats(Number(escrow.amount) - Number(escrow.house_fee));
    }
    save();
    return json(escrow);
  }

  if (seg[0] === "escrow" && seg.length === 3 && method === "POST") {
    const map: Record<string, string> = { release: "released", dispute: "disputed", cancel: "cancelled" };
    const escrow = db.escrows.find((e) => e.id === seg[1]);
    if (!escrow || !map[seg[2]]) return json({ error: "Not found" }, 404);
    escrow.status = map[seg[2]];
    if (escrow.status === "released" || escrow.status === "cancelled") {
      escrow.house_fee = creditHouse("escrow", String(escrow.id), Number(escrow.amount), String(escrow.sender || ""));
      escrow.house_fee_percent = 3;
      escrow.net_amount = sats(Number(escrow.amount) - Number(escrow.house_fee));
    }
    save();
    return json(escrow);
  }

  if (seg[0] === "search" && seg[1] === "messages" && method === "GET") {
    const handle = q.get("handle") || "";
    const query = (q.get("q") || "").toLowerCase();
    const results: Array<Record<string, unknown>> = [];
    for (const conv of db.conversations.filter((c) => sameHandle(c.user1_handle, handle) || sameHandle(c.user2_handle, handle))) {
      const other = sameHandle(conv.user1_handle, handle) ? conv.user2_handle : conv.user1_handle;
      for (const msg of db.messages.filter((m) => m.conversation_id === conv.id && !m.e2e_encrypted && m.content.toLowerCase().includes(query))) {
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
    const password = String(body.password || "");
    if (!room.password || room.password !== password) return json({ valid: false });
    return json({ valid: true, key: await roomKeyFromPassphrase(password, room.id) });
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

  if (seg[0] === "chat-rooms" && seg[2] === "key" && method === "POST") {
    const body = await readJson(input, init);
    const room = db.chatRooms.find((item) => item.id === seg[1]);
    if (!room?.password || !sameHandle(room.creator_handle, body.handle)) return json({ error: "No key" }, 403);
    return json({ key: await roomKeyFromPassphrase(room.password, room.id) });
  }

  if (seg[0] === "chat-rooms" && seg[2] === "messages" && method === "POST") {
    const body = await readJson(input, init);
    const stopped = guard(String(body.sender || ""), String(body.content || ""));
    if (stopped) return stopped;
    const room = db.chatRooms.find((item) => item.id === seg[1]);
    let content = String(body.content || "");
    let sealed = body.e2eEncrypted ? 1 : 0;
    if (room?.is_locked && room.password) {
      content = JSON.stringify(await encryptForRoom(content, await roomKeyFromPassphrase(room.password, room.id)));
      sealed = 1;
    }
    const msg = {
      id: nid(),
      room_id: seg[1],
      sender_handle: body.sender,
      content,
      timestamp: Date.now(),
      emoji_encrypted: body.emojiEncrypted ? 1 : 0,
      e2e_encrypted: sealed,
      reply_to: body.replyTo ?? null,
      reply_content: body.replyContent ?? null,
      reply_sender: body.replySender ?? null,
    };
    db.roomMessages.push(msg);
    save();
    return json(msg);
  }

  if (seg[0] === "chat-rooms" && seg.length === 2 && method === "DELETE") {
    const id = seg[1];
    db.chatRooms = db.chatRooms.filter((r) => r.id !== id);
    db.roomMessages = db.roomMessages.filter((m) => m.room_id !== id);
    if (!Array.isArray(db.removedRooms)) db.removedRooms = [];
    if (!db.removedRooms.includes(id)) db.removedRooms.push(id);
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
    const stopped = guard(String(body.authorHandle || body.author || ""), String(body.content || ""));
    if (stopped) return stopped;
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

  if (seg[0] === "keys" && seg[1] === "mine" && method === "POST") {
    const body = await readJson(input, init);
    const key = await ensureUserKey(String(body.handle || ""));
    save();
    return json({ handle: key.handle, publicKey: key.publicKey, privateKey: key.privateKey, history: key.history || [] });
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
    return json({ stdout: await runSyn(String(body.command || "")), error: null });
  }

  if (seg[0] === "market" && seg.length === 1 && method === "GET") {
    touchMarket();
    return json(db.listings);
  }

  if (seg[0] === "market" && seg.length === 1 && method === "POST") {
    touchMarket();
    const body = await readJson(input, init);
    const title = String(body.title || "").trim();
    const category = String(body.category || "").trim().slice(0, 40);
    if (!category) return json({ error: "Type a category" }, 400);
    const seller = String(body.seller || "").trim();
    const start = Number(body.start_price);
    const days = Number(body.days);
    if (!seller || title.length < 3) return json({ error: "A title is required" }, 400);
    const stopped = guard(seller, title);
    if (stopped) return stopped;
    if (!Number.isFinite(start) || start <= 0) return json({ error: "Set a starting price" }, 400);
    if (![1, 3, 5, 7].includes(days)) return json({ error: "Choose a duration" }, 400);
    const buyNow = body.buy_now === null || body.buy_now === "" || body.buy_now === undefined ? null : Number(body.buy_now);
    if (buyNow !== null && (!Number.isFinite(buyNow) || buyNow <= start)) {
      return json({ error: "Buy now must be higher than the opening price" }, 400);
    }
    const lot: Listing = {
      id: "lot" + nid(),
      seller,
      title: title.slice(0, 80),
      description: String(body.description || "").trim().slice(0, 800),
      category,
      image: typeof body.image === "string" && (body.image.startsWith("data:image/") || body.image.startsWith("vault:")) ? body.image : null,
      start_price: sats(start),
      buy_now: buyNow === null ? null : sats(buyNow),
      ends_at: Date.now() + days * 86400000,
      created_at: Date.now(),
      status: "live",
      winner: null,
      sold_price: null,
      bids: [],
      watchers: [],
    };
    db.listings.unshift(lot);
    save();
    return json(lot);
  }

  if (seg[0] === "market" && seg[2] === "bid" && method === "POST") {
    touchMarket();
    const lot = db.listings.find((item) => item.id === seg[1]);
    if (!lot) return json({ error: "Lot not found" }, 404);
    if (lot.status !== "live") return json({ error: "This auction has closed" }, 400);
    const body = await readJson(input, init);
    const bidder = String(body.bidder || "").trim();
    const amount = Number(body.amount);
    if (!bidder) return json({ error: "Sign in first" }, 400);
    if (bidder.toLowerCase() === lot.seller.toLowerCase()) return json({ error: "You cannot bid on your own lot" }, 400);
    const minimum = nextBid(lot);
    if (!Number.isFinite(amount) || amount < minimum) return json({ error: "Bid at least " + minimum.toFixed(8) + " BTC" }, 400);
    lot.bids.push({ id: "bid" + nid(), bidder, amount: sats(amount), timestamp: Date.now() });
    creditHouse("auction", lot.id + ":" + bidder.toLowerCase() + ":" + String(lot.bids.length), sats(amount), bidder);
    save();
    return json(lot);
  }

  if (seg[0] === "market" && seg[2] === "buy" && method === "POST") {
    touchMarket();
    const lot = db.listings.find((item) => item.id === seg[1]);
    if (!lot || lot.buy_now === null) return json({ error: "Buy now is not offered" }, 400);
    if (lot.status !== "live") return json({ error: "This auction has closed" }, 400);
    const body = await readJson(input, init);
    const bidder = String(body.bidder || "").trim();
    if (!bidder) return json({ error: "Sign in first" }, 400);
    if (bidder.toLowerCase() === lot.seller.toLowerCase()) return json({ error: "You cannot buy your own lot" }, 400);
    lot.bids.push({ id: "bid" + nid(), bidder, amount: lot.buy_now, timestamp: Date.now() });
    lot.status = "sold";
    lot.winner = bidder;
    lot.sold_price = lot.buy_now;
    lot.house_fee = creditHouse("auction", lot.id, lot.buy_now, bidder);
    lot.ends_at = Date.now();
    save();
    return json(lot);
  }

  if (seg[0] === "market" && seg[2] === "watch" && method === "POST") {
    touchMarket();
    const lot = db.listings.find((item) => item.id === seg[1]);
    if (!lot) return json({ error: "Lot not found" }, 404);
    const body = await readJson(input, init);
    const handle = String(body.handle || "").trim();
    if (!handle) return json({ error: "Sign in first" }, 400);
    const key = handle.toLowerCase();
    const has = lot.watchers.some((name) => name.toLowerCase() === key);
    lot.watchers = has ? lot.watchers.filter((name) => name.toLowerCase() !== key) : [...lot.watchers, handle];
    save();
    return json(lot);
  }

  if (seg[0] === "market" && seg[2] === "cancel" && method === "POST") {
    touchMarket();
    const lot = db.listings.find((item) => item.id === seg[1]);
    if (!lot) return json({ error: "Lot not found" }, 404);
    const body = await readJson(input, init);
    const seller = String(body.seller || "").trim();
    if (seller.toLowerCase() !== lot.seller.toLowerCase()) return json({ error: "Only the seller can end this" }, 403);
    if (lot.status !== "live") return json({ error: "This auction has closed" }, 400);
    if (lot.bids.length) return json({ error: "Bids are already in. Let it finish." }, 400);
    lot.status = "cancelled";
    save();
    return json(lot);
  }

  return json({ error: "Not found" }, 404);
}

export function installLocalApi() {
  if (typeof window === "undefined") return;
  const w = window as Window & { __omertaApi?: boolean };
  if (w.__omertaApi) return;
  w.__omertaApi = true;
  void navigator.storage?.persist?.();
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
