import { useState } from 'react';
import { useApp } from '@/store/AppContext';
import { Zap, X } from 'lucide-react';

interface SecretAdminLoginProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SecretAdminLogin({ isOpen, onClose }: SecretAdminLoginProps) {
  const { setUserRole, login } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Admin: Flint / Texasmade713
    if (username === 'Flint' && password === 'Texasmade713') {
      setUserRole('admin');
      login('Flint');
      setUsername('');
      setPassword('');
      onClose();
      return;
    }

    // Moderator: Steel / Southside
    if (username === 'Steel' && password === 'Southside') {
      setUserRole('moderator');
      login('Steel');
      setUsername('');
      setPassword('');
      onClose();
      return;
    }

    // Moderator: Peachy / fourteen
    if (username === 'Peachy' && password === 'fourteen') {
      setUserRole('moderator');
      login('Peachy');
      setUsername('');
      setPassword('');
      onClose();
      return;
    }

    setError('// INVALID CREDENTIALS //');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center" style={{ background: 'hsl(var(--background) / 0.95)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-sm mx-4 rounded-xl p-6 border" style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--primary) / 0.3)' }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Zap size={18} style={{ color: 'hsl(var(--primary))' }} />
            <h3 className="font-serif text-xl tracking-wider" style={{ color: 'hsl(var(--primary))' }}>ADMIN ACCESS</h3>
          </div>
          <button onClick={onClose} className="font-mono text-xs px-2 py-1 rounded border transition-all" style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}><X size={16} /></button>
        </div>
        <p className="font-mono text-[10px] tracking-wider mb-4" style={{ color: 'hsl(var(--muted-foreground))' }}>// SYSTEM ADMINISTRATOR LOGIN //</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider mb-1" style={{ color: 'hsl(var(--muted-foreground))' }}>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username..."
              className="w-full rounded-sm px-3 py-2 font-mono text-sm"
              style={{ background: 'hsl(var(--input))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' }}
              autoFocus
            />
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider mb-1" style={{ color: 'hsl(var(--muted-foreground))' }}>Passphrase</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••"
              className="w-full rounded-sm px-3 py-2 font-mono text-sm"
              style={{ background: 'hsl(var(--input))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' }}
            />
          </div>
          {error && (
            <p className="font-mono text-xs text-center" style={{ color: 'hsl(var(--destructive))' }}>{error}</p>
          )}
          <button
            type="submit"
            disabled={!username.trim() || !password.trim()}
            className="w-full py-3 font-mono text-xs uppercase tracking-wider rounded-md hover:brightness-110 disabled:opacity-30 transition-all"
            style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
          >
            <Zap size={14} className="inline mr-2" />
            Authenticate
          </button>
        </form>
      </div>
    </div>
  );
}
