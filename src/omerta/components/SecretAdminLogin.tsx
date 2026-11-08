import { useRef, useState } from 'react';
import { useApp } from '@omerta/store/AppContext';
import { grantLocalRole } from '@omerta/local-api';
import { Zap, X } from 'lucide-react';

interface SecretAdminLoginProps {
  isOpen: boolean;
  onClose: () => void;
}

const doors: Array<[string, string, "admin" | "moderator", string]> = [
  ["flint", "dbcf1a61191cb56252431eeb5a00a291892e70de546d5448612bcc461b374aaf", "admin", "Flint"],
  ["steel", "7addefc49004084a5e9ec2d6d3fa238b7202b958e5db8c69e23f05c72ef86736", "moderator", "Steel"],
  ["peachy", "fef8f41cdcd2038663b027a0cfbe252d39510bc162b599d1d4aa683873cc21d7", "moderator", "Peachy"],
];

function normalize(value: string) {
  return value.normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
}

function sha256(value: string) {
  const k = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const bytes = new TextEncoder().encode(value);
  const bits = bytes.length * 8;
  const padded = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, bits, false);
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a, h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const w = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = ((w[i - 15] >>> 7) | (w[i - 15] << 25)) ^ ((w[i - 15] >>> 18) | (w[i - 15] << 14)) ^ (w[i - 15] >>> 3);
      const s1 = ((w[i - 2] >>> 17) | (w[i - 2] << 15)) ^ ((w[i - 2] >>> 19) | (w[i - 2] << 13)) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + k[i] + w[i]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7].map((n) => n.toString(16).padStart(8, "0")).join("");
}

export default function SecretAdminLogin({ isOpen, onClose }: SecretAdminLoginProps) {
  const { setUserRole, login } = useApp();
  const userRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const authenticate = async (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (busy) return;
    const name = normalize(userRef.current?.value || "").toLowerCase();
    const secret = normalize(passRef.current?.value || "");
    if (!name || !secret) {
      setError("// INVALID CREDENTIALS //");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const hashed = sha256(secret);
      const match = doors.find((row) => row[0] === name && row[1] === hashed);
      if (!match) {
        setError("// INVALID CREDENTIALS //");
        return;
      }
      login(match[3]);
      setUserRole(match[2]);
      onClose();
      void grantLocalRole(match[3], match[2], secret).catch(() => {});
    } catch {
      setError("// INVALID CREDENTIALS //");
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4" style={{ background: "hsl(var(--background) / 0.95)" }} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
      <div className="w-full max-w-sm rounded-xl p-6 border" style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--primary) / 0.3)" }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Zap size={18} style={{ color: "hsl(var(--primary))" }} />
            <h3 className="font-serif text-xl tracking-wider" style={{ color: "hsl(var(--primary))" }}>ADMIN ACCESS</h3>
          </div>
          <button type="button" onClick={onClose} className="font-mono text-xs px-2 py-1 rounded border" style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}><X size={16} /></button>
        </div>
        <p className="font-mono text-[10px] tracking-wider mb-4" style={{ color: "hsl(var(--muted-foreground))" }}>// SYSTEM ADMINISTRATOR LOGIN //</p>
        <form onSubmit={authenticate} className="space-y-4">
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>Username</label>
            <input
              ref={userRef}
              name="username"
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
              placeholder="Enter username..."
              className="w-full rounded-sm px-3 py-2 font-mono text-sm"
              style={{ background: "hsl(var(--input))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }}
              autoFocus
            />
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>Passphrase</label>
            <input
              ref={passRef}
              name="passphrase"
              type="password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
              placeholder="••••••••••"
              className="w-full rounded-sm px-3 py-2 font-mono text-sm"
              style={{ background: "hsl(var(--input))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }}
            />
          </div>
          {error && (
            <p className="font-mono text-xs text-center" style={{ color: "hsl(var(--destructive))" }}>{error}</p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 font-mono text-xs uppercase tracking-wider rounded-md disabled:opacity-50"
            style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
          >
            <Zap size={14} className="inline mr-2" />
            {busy ? "..." : "Authenticate"}
          </button>
        </form>
      </div>
    </div>
  );
}
