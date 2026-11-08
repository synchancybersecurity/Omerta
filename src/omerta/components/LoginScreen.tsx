import { useState, useEffect } from 'react';
import { ScrambleText } from '@omerta/hooks/useScrambleText';
import { Lock, Zap } from 'lucide-react';
import { useApp } from '@omerta/store/AppContext';
import { useApi } from '@omerta/store/ApiContext';
import { useCoinDrag } from '@omerta/hooks/useCoinDrag';
import SecretAdminLogin from './SecretAdminLogin';

export default function LoginScreen() {
  const [handle, setHandle] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [loginError, setLoginError] = useState('');
  const [showSecretLogin, setShowSecretLogin] = useState(false);
  const { login, userRole, setUserRole } = useApp();
  const { auth, register } = useApi();

  const { rotation, wasActivated, handlers } = useCoinDrag({
    holdMs: 5000,
    onActivate: () => {
      // Coin is now glowing red and flippable
    },
    onComboComplete: () => {
      // Correct flip sequence completed - show secret admin login
      setShowSecretLogin(true);
    },
  });

  useEffect(() => {
    const t = setTimeout(() => setShowLogin(true), 400);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handle.trim()) return;
    setIsSubmitting(true);
    setLoginError('');

    // Try to authenticate via API first
    const result = await auth(handle.trim(), passphrase);
    if (result.success) {
      if (result.role) setUserRole(result.role as 'basic' | 'moderator' | 'admin');
      login(handle.trim());
    } else {
      // If auth fails (user doesn't exist), auto-register
      const regResult = await register(handle.trim(), passphrase);
      if (regResult.success) {
        if (regResult.role) setUserRole(regResult.role as 'basic' | 'moderator' | 'admin');
        login(handle.trim());
      } else {
        setLoginError(regResult.error || 'Authentication failed');
      }
    }
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Secret Admin Login — appears after correct coin flip sequence */}
      <SecretAdminLogin isOpen={showSecretLogin} onClose={() => setShowSecretLogin(false)} />

      {/* Admin indicator — shows when admin is active */}
      {userRole === 'admin' && (
        <div className="absolute top-4 right-4 z-[60] px-3 py-2 rounded-md flex items-center gap-2" style={{ background: 'hsl(var(--primary) / 0.12)', border: '1px solid hsl(var(--primary))' }}>
          <Zap size={14} style={{ color: 'hsl(var(--primary))' }} />
          <span className="font-mono text-xs" style={{ color: 'hsl(var(--primary))' }}>ADMIN ACTIVE</span>
          <button onClick={() => setUserRole('basic')} className="ml-2 font-mono text-[10px]" style={{ color: 'hsl(var(--primary))' }}>EXIT</button>
        </div>
      )}

      {/* Solid panel behind form */}
      <div className="w-full max-w-md px-6 py-10">
        <div className="rounded-xl px-8 py-10" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
          {/* Logo — tap and hold for 5s, then coin flips and glows red */}
          <div className={`flex justify-center mb-6 relative transition-all duration-700 ${showLogin ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`} style={{ perspective: '400px' }}>
            <img
              src="/logo.jpg"
              alt="Omerta"
              draggable={false}
              className="w-36 h-36 md:w-44 md:h-44 object-contain select-none touch-none rounded-full"
              style={{
                transformStyle: 'preserve-3d',
                transform: `rotateX(${rotation}deg)`,
                filter: wasActivated
                  ? 'drop-shadow(0 0 12px rgba(185,28,28,0.9)) drop-shadow(0 0 30px rgba(185,28,28,0.6)) drop-shadow(0 0 50px rgba(185,28,28,0.3))'
                  : 'drop-shadow(0 0 8px rgba(255,255,255,0.1))',
              }}
              {...handlers}
            />

          </div>

          <div className="text-center mb-10">
            <h1 className="font-serif text-6xl md:text-7xl font-bold tracking-wider mb-2" style={{ color: 'hsl(var(--foreground))' }}>
              <ScrambleText text="OMERTA" trigger={showLogin} speed={40} />
            </h1>
            <p className="font-mono text-sm tracking-[0.3em] uppercase mt-4" style={{ color: 'hsl(var(--muted-foreground))' }}>
              <ScrambleText text="// CODE OF SILENCE //" trigger={showLogin} speed={25} />
            </p>
          </div>

          <form onSubmit={handleSubmit} className={`space-y-5 transition-all duration-700 ${showLogin ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div>
              <label className="block font-mono text-xs uppercase tracking-wider mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
                Anonymous Handle
              </label>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="Enter your handle..."
                className="w-full rounded-sm px-4 py-3 font-mono text-sm focus:outline-none transition-colors"
                style={{
                  background: 'hsl(var(--input))',
                  border: '1px solid hsl(var(--border))',
                  color: 'hsl(var(--foreground))',
                }}
                autoFocus
              />
            </div>
            <div>
              <label className="block font-mono text-xs uppercase tracking-wider mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>
                Passphrase
              </label>
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="****************"
                className="w-full rounded-sm px-4 py-3 font-mono text-sm focus:outline-none transition-colors"
                style={{
                  background: 'hsl(var(--input))',
                  border: '1px solid hsl(var(--border))',
                  color: 'hsl(var(--foreground))',
                }}
              />
            </div>
            {loginError && (
              <p className="font-mono text-xs text-blood text-center">{loginError}</p>
            )}
            <button
              type="submit"
              disabled={!handle.trim() || isSubmitting}
              className="w-full py-4 border font-mono text-sm uppercase tracking-[0.2em] hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-3 rounded-sm"
              style={{ borderColor: 'hsl(var(--primary))', color: 'hsl(var(--primary))' }}
            >
              {isSubmitting ? (
                <span className="animate-pulse">AUTHENTICATING...</span>
              ) : (
                <>
                  <Lock size={16} />
                  ENTER THE VAULT
                </>
              )}
            </button>
          </form>

          <p className={`text-center font-mono text-[10px] mt-8 tracking-wider transition-opacity duration-700 delay-500 ${showLogin ? 'opacity-100' : 'opacity-0'}`} style={{ color: 'hsl(var(--muted-foreground))' }}>
            NO REAL NAMES. NO TRACES. NO LOGS.
          </p>
        </div>
      </div>

      {/* Secret Admin Login Modal */}

    </div>
  );
}
