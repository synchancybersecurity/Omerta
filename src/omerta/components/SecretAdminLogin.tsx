import { useRef, useState } from 'react';
import { useApp } from '@omerta/store/AppContext';
import { Zap, X } from 'lucide-react';

interface SecretAdminLoginProps {
  isOpen: boolean;
  onClose: () => void;
}

const ADMINS = [
  { username: "flint", password: "Texasmade713", role: "admin" as const, handle: "Flint" },
  { username: "steel", password: "Southside", role: "moderator" as const, handle: "Steel" },
  { username: "peachy", password: "fourteen", role: "moderator" as const, handle: "Peachy" },
];

export default function SecretAdminLogin({ isOpen, onClose }: SecretAdminLoginProps) {
  const { setUserRole, login } = useApp();
  const userRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');

  const authenticate = (e?: React.FormEvent) => {
    e?.preventDefault();
    setError("");
    const username = (userRef.current?.value || "").trim().toLowerCase();
    const password = (passRef.current?.value || "").trim();
    const match = ADMINS.find((row) => row.username === username && row.password === password);
    if (!match) {
      setError("// INVALID CREDENTIALS //");
      return;
    }
    setUserRole(match.role);
    login(match.handle);
    if (userRef.current) userRef.current.value = "";
    if (passRef.current) passRef.current.value = "";
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4" style={{ background: "hsl(var(--background) / 0.95)" }}>
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
              autoComplete="username"
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
              autoComplete="current-password"
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
            className="w-full py-3 font-mono text-xs uppercase tracking-wider rounded-md"
            style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
          >
            <Zap size={14} className="inline mr-2" />
            Authenticate
          </button>
        </form>
      </div>
    </div>
  );
}
