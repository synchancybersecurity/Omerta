import { schnorr } from "@noble/curves/secp256k1";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes, randomBytes } from "@noble/hashes/utils.js";

const RELAYS = ["wss://relay.damus.io", "wss://relay.primal.net", "wss://nos.lol"];
const TAG = "omerta-public";

export type PublicBoard = {
  posts: Array<Record<string, unknown>>;
  chat: Array<Record<string, unknown>>;
  rooms: Array<Record<string, unknown>>;
  roomMessages: Array<Record<string, unknown>>;
  lots: Array<Record<string, unknown>>;
  captures?: Array<Record<string, unknown>>;
  wipes?: Array<{ handle?: string; at?: number }>;
};

type NostrEvent = {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
};

function keypair() {
  const stored = typeof localStorage !== "undefined" ? localStorage.getItem("omerta-board") : "";
  const secret = stored && /^[a-f0-9]{64}$/.test(stored) ? hexToBytes(stored) : randomBytes(32);
  if (typeof localStorage !== "undefined" && !stored) localStorage.setItem("omerta-board", bytesToHex(secret));
  return { secret, pubkey: bytesToHex(schnorr.getPublicKey(secret)) };
}

function sign(pubkey: string, content: string, secret: Uint8Array): NostrEvent {
  const created_at = Math.floor(Date.now() / 1000);
  const tags = [["t", TAG]];
  const serial = JSON.stringify([0, pubkey, created_at, 1, tags, content]);
  const id = bytesToHex(sha256(new TextEncoder().encode(serial)));
  const sig = bytesToHex(schnorr.sign(hexToBytes(id), secret));
  return { id, pubkey, created_at, kind: 1, tags, content, sig };
}

function parseBoard(content: string): PublicBoard | null {
  try {
    const data = JSON.parse(content) as PublicBoard;
    if (!data || !Array.isArray(data.posts) || !Array.isArray(data.lots)) return null;
    return data;
  } catch {
    return null;
  }
}

export function exchangeBoard(mine: PublicBoard): Promise<PublicBoard[]> {
  if (typeof WebSocket === "undefined") return Promise.resolve([]);
  const content = JSON.stringify(mine);
  const { secret, pubkey } = keypair();
  const event = sign(pubkey, content, secret);
  return new Promise((resolve) => {
    let relay = 0;
    const found: PublicBoard[] = [];
    const finish = () => resolve(found);
    const tryRelay = () => {
      if (relay >= RELAYS.length) return finish();
      const url = RELAYS[relay++];
      let socket: WebSocket;
      try { socket = new WebSocket(url); } catch { tryRelay(); return; }
      let settled = false;
      const settle = (again: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        socket.close();
        if (again && !found.length) tryRelay();
        else finish();
      };
      const timer = setTimeout(() => settle(true), 4500);
      socket.onerror = () => settle(true);
      socket.onopen = () => {
        if (content !== lastSent) socket.send(JSON.stringify(["EVENT", event]));
        socket.send(JSON.stringify(["REQ", "omerta", { kinds: [1], "#t": [TAG], limit: 20 }]));
      };
      socket.onmessage = (message) => {
        try {
          const data = JSON.parse(String(message.data));
          if (data[0] === "OK" && data[2] === true) lastSent = content;
          if (data[0] === "EVENT" && data[2]?.content) {
            const board = parseBoard(data[2].content);
            if (board) found.push(board);
          }
          if (data[0] === "EOSE") settle(false);
        } catch { /* ignore a bad relay frame */ }
      };
    };
    tryRelay();
  });
}

let lastSent = "";
