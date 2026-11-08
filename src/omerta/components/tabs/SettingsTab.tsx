import { useState, useEffect } from 'react';
import {
  Bell, Eye, Shield, Globe, Moon, Volume2, AlertTriangle, CheckCircle,
  Zap, Lock, Unlock, Radio, UserX, KeyRound, Palette, RotateCcw, Droplets, Sun, Type,
  MessageSquare, MessageCircle, Square, Minus, AlignLeft, Sparkles, Trash2,
  ShieldCheck, UserPlus, UserCog, Wallet, Landmark, Gavel,
  ChevronDown, User, Crown, Search, X
} from 'lucide-react';
import { payHouseCut, readHouseBalance } from '@omerta/chain';
import { useApp } from '@omerta/store/AppContext';
import { useApi, API_BASE_URL } from '@omerta/store/ApiContext';

interface ToggleSetting {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  enabled: boolean;
}

function DropdownSection({ title, subtitle, icon: Icon, children, defaultOpen = false, accent = false }: {
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  accent?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="max-w-2xl mb-3 border rounded-lg overflow-hidden" style={{ borderColor: accent ? 'hsl(var(--primary) / 0.4)' : 'hsl(var(--border))', background: 'hsl(var(--card))' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 transition-all hover:brightness-110"
        style={{ background: 'hsl(var(--card))' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-sm flex-shrink-0" style={{ background: accent ? 'hsl(var(--primary) / 0.12)' : 'hsl(var(--muted))' }}>
            <Icon size={16} style={{ color: accent ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }} />
          </div>
          <div className="min-w-0 text-left">
            <h3 className="font-mono text-xs uppercase tracking-wider truncate" style={{ color: accent ? 'hsl(var(--primary))' : 'hsl(var(--card-foreground))' }}>{title}</h3>
            {subtitle && <p className="font-mono text-[9px] tracking-wider truncate" style={{ color: 'hsl(var(--muted-foreground))' }}>{subtitle}</p>}
          </div>
        </div>
        <ChevronDown
          size={16}
          className={`flex-shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          style={{ color: 'hsl(var(--muted-foreground))' }}
        />
      </button>
      <div
        className="transition-all duration-300 overflow-hidden"
        style={{ maxHeight: open ? '2000px' : '0px', opacity: open ? 1 : 0 }}
      >
        <div className="p-4 pt-0 border-t" style={{ borderColor: 'hsl(var(--border))' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function HouseEscrowSettings() {
  const { userHandle } = useApp();
  const { houseSettings, fetchHouseSettings, saveHouseSettings } = useApi();
  const [feeWallet, setFeeWallet] = useState(houseSettings.feeWallet);
  const [chain, setChain] = useState(houseSettings.chain || "base");
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState("");
  const [balance, setBalance] = useState("");
  const isFlint = userHandle.trim().toLowerCase() === "flint";

  useEffect(() => { fetchHouseSettings(); }, [fetchHouseSettings]);
  useEffect(() => { setFeeWallet(houseSettings.feeWallet); }, [houseSettings.feeWallet]);
  useEffect(() => { setChain(houseSettings.chain || "base"); }, [houseSettings.chain]);

  const collected = (houseSettings.deposits || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const pending = (houseSettings.payments || []).filter((row) => row.status !== "sent");

  const handleSave = async () => {
    const result = await saveHouseSettings({ feeWallet, chain, actor: userHandle });
    if (result && result.error) {
      setNotice(result.error);
      return;
    }
    setNotice("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const checkChain = async () => {
    setNotice("");
    setBalance("");
    try {
      const result = await readHouseBalance(chain, feeWallet);
      setBalance(result.chain + " is connected. The house wallet holds " + result.usdc.toFixed(2) + " USDC.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "The chain did not answer");
    }
  };

  const sendCut = async (row: { id: string; amount: number; wallet: string; chain: string }) => {
    try {
      const result = await payHouseCut(row.chain || chain, row.wallet, row.amount);
      if (result.tx) {
        await fetch("/api/house/payments/" + row.id + "/sent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tx: result.tx }),
        });
        setBalance("Sent " + result.tx);
        fetchHouseSettings();
      } else if (result.opened) {
        setBalance("Approve the USDC transfer in your wallet.");
      } else {
        setNotice(result.error || "The wallet did not open");
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "The transfer was refused");
    }
  };

  return (
    <div className="space-y-4 pt-2">
      <p className="font-mono text-[10px] leading-relaxed" style={{ color: "hsl(var(--muted-foreground))" }}>
        The house keeps 3 percent of every auction sale and every escrow payment. On Base or Ethereum that cut is a USDC transfer to the wallet below. Your wallet must approve it. This app never holds the key.
      </p>
      <div className="p-3 border rounded-lg" style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--background))" }}>
        <span className="font-mono text-[9px] uppercase" style={{ color: "hsl(var(--muted-foreground))" }}>Credited to the house</span>
        <p className="font-mono text-lg" style={{ color: "hsl(var(--primary))" }}>${collected.toFixed(2)}</p>
        {balance && <p className="font-mono text-[10px] mt-2 break-all" style={{ color: "hsl(var(--foreground))" }}>{balance}</p>}
      </div>
      <div>
        <label className="font-mono text-[10px] uppercase tracking-wider mb-1.5 block" style={{ color: "hsl(var(--muted-foreground))" }}>Chain</label>
        <select value={chain} disabled={!isFlint} onChange={(e) => setChain(e.target.value)} className="w-full p-2.5 rounded-md font-mono text-xs" style={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }}>
          <option value="base">Base</option>
          <option value="ethereum">Ethereum</option>
        </select>
      </div>
      <div>
        <label className="font-mono text-[10px] uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: "hsl(var(--muted-foreground))" }}>
          <Wallet size={10} /> House wallet
        </label>
        <input
          type="text"
          value={feeWallet}
          onChange={e => setFeeWallet(e.target.value)}
          disabled={!isFlint}
          placeholder="0x house wallet for USDC"
          className="w-full p-2.5 rounded-md font-mono text-xs focus:outline-none disabled:opacity-60"
          style={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }}
        />
      </div>
      {notice && <p className="font-mono text-[10px]" style={{ color: "hsl(var(--destructive))" }}>{notice}</p>}
      <button type="button" onClick={() => void checkChain()} className="w-full py-2 font-mono text-xs uppercase tracking-wider rounded-sm border" style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}>
        Check chain
      </button>
      {isFlint && (
        <button
          onClick={handleSave}
          className="w-full py-2 font-mono text-xs uppercase tracking-wider rounded-sm transition-all hover:brightness-110"
          style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
        >
          {saved ? "// SAVED //" : "Save house wallet"}
        </button>
      )}
      {pending.map((row) => (
        <div key={row.id} className="flex items-center justify-between gap-2 font-mono text-[10px] border-b py-2" style={{ borderColor: "hsl(var(--border))" }}>
          <span style={{ color: "hsl(var(--muted-foreground))" }}>{row.source === "auction" ? "Auction" : "Escrow"} · {row.amount.toFixed(2)} USDC</span>
          <button type="button" onClick={() => void sendCut(row)} className="px-2 py-1 uppercase" style={{ color: "hsl(var(--primary))" }}>Send</button>
        </div>
      ))}
      {(houseSettings.deposits || []).slice(0, 8).map((row) => (
        <div key={row.id} className="flex items-center justify-between font-mono text-[10px] border-b py-2" style={{ borderColor: "hsl(var(--border))" }}>
          <span style={{ color: "hsl(var(--muted-foreground))" }}>{row.source === "auction" ? "Auction" : "Escrow"} · ${Number(row.gross).toFixed(2)}</span>
          <span style={{ color: "hsl(var(--primary))" }}>${Number(row.amount).toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

function AdminEscrowOversight() {
  const { userHandle } = useApp();
  const { escrows, fetchAllEscrows, resolveEscrow, houseSettings } = useApi();
  const [selectedEscrow, setSelectedEscrow] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');

  useEffect(() => { fetchAllEscrows(); }, [fetchAllEscrows]);

  const handleResolve = async (id: string, resolution: 'released' | 'refunded' | 'disputed') => {
    await resolveEscrow(id, resolution, userHandle, resolutionNote);
    setSelectedEscrow(null);
    setResolutionNote('');
    fetchAllEscrows();
  };

  const totalVolume = escrows.reduce((s, e) => s + e.amount, 0);
  const totalFees = escrows.filter(e => e.status === 'released').reduce((s, e) => s + (e.house_fee || 0), 0);
  const pendingCount = escrows.filter(e => e.status === 'pending').length;
  const disputedCount = escrows.filter(e => e.status === 'disputed').length;

  return (
    <div className="space-y-3 pt-2">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        <div className="p-2 border rounded-lg text-center" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--background))' }}>
          <span className="font-mono text-[9px] uppercase" style={{ color: 'hsl(var(--muted-foreground))' }}>Volume</span>
          <p className="font-mono text-sm" style={{ color: 'hsl(var(--foreground))' }}>${totalVolume.toFixed(2)}</p>
        </div>
        <div className="p-2 border rounded-lg text-center" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--background))' }}>
          <span className="font-mono text-[9px] uppercase" style={{ color: 'hsl(var(--muted-foreground))' }}>Fees</span>
          <p className="font-mono text-sm" style={{ color: 'hsl(var(--primary))' }}>${totalFees.toFixed(2)}</p>
        </div>
        <div className="p-2 border rounded-lg text-center" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--background))' }}>
          <span className="font-mono text-[9px] uppercase" style={{ color: 'hsl(var(--muted-foreground))' }}>Pending</span>
          <p className="font-mono text-sm" style={{ color: 'hsl(45, 90%, 40%)' }}>{pendingCount}</p>
        </div>
        <div className="p-2 border rounded-lg text-center" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--background))' }}>
          <span className="font-mono text-[9px] uppercase" style={{ color: 'hsl(var(--muted-foreground))' }}>Disputes</span>
          <p className="font-mono text-sm" style={{ color: 'hsl(var(--destructive))' }}>{disputedCount}</p>
        </div>
      </div>

      {/* House Wallets */}
      {(houseSettings.holdingWallet || houseSettings.feeWallet) && (
        <div className="p-3 border rounded-lg" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--background))' }}>
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={12} style={{ color: 'hsl(var(--primary))' }} />
            <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: 'hsl(var(--primary))' }}>House Wallets</span>
          </div>
          {houseSettings.holdingWallet && (
            <div className="flex justify-between font-mono text-[10px] mb-1">
              <span style={{ color: 'hsl(var(--muted-foreground))' }}>Holding</span>
              <span className="truncate max-w-[200px]" style={{ color: 'hsl(var(--foreground))' }}>{houseSettings.holdingWallet}</span>
            </div>
          )}
          {houseSettings.feeWallet && (
            <div className="flex justify-between font-mono text-[10px]">
              <span style={{ color: 'hsl(var(--muted-foreground))' }}>Fee</span>
              <span className="truncate max-w-[200px]" style={{ color: 'hsl(var(--primary))' }}>{houseSettings.feeWallet}</span>
            </div>
          )}
        </div>
      )}

      {/* Escrow List */}
      {escrows.length === 0 && (
        <div className="p-6 border rounded-lg text-center" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--background))' }}>
          <p className="font-mono text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>No escrow transactions on record</p>
        </div>
      )}

      {escrows.map(escrow => {
        const statusColors: Record<string, { text: string; border: string }> = {
          pending: { text: 'hsl(45, 90%, 40%)', border: 'hsl(45, 90%, 40%)' },
          released: { text: 'hsl(142, 76%, 36%)', border: 'hsl(142, 76%, 36%)' },
          disputed: { text: 'hsl(var(--destructive))', border: 'hsl(var(--destructive))' },
          refunded: { text: 'hsl(200, 80%, 50%)', border: 'hsl(200, 80%, 50%)' },
          cancelled: { text: 'hsl(var(--muted-foreground))', border: 'hsl(var(--border))' },
        };
        const sc = statusColors[escrow.status] || statusColors.pending;

        return (
          <div key={escrow.id} className="p-3 border rounded-lg" style={{ borderColor: sc.border, background: 'hsl(var(--background))' }}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <span className="font-mono text-xs uppercase tracking-wider" style={{ color: sc.text }}>{escrow.status}</span>
                <p className="font-mono text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>{escrow.id}</p>
              </div>
              <span className="font-mono text-lg font-bold" style={{ color: 'hsl(var(--foreground))' }}>${escrow.amount.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2 mb-1 font-mono text-[11px]">
              <span style={{ color: 'hsl(var(--foreground))' }}>{escrow.sender}</span>
              <span style={{ color: 'hsl(var(--muted-foreground))' }}>→</span>
              <span style={{ color: 'hsl(var(--foreground))' }}>{escrow.recipient}</span>
            </div>
            {escrow.description && (
              <p className="font-mono text-[10px] mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>{escrow.description}</p>
            )}
            <div className="flex justify-between font-mono text-[9px] mb-2">
              <span style={{ color: 'hsl(var(--muted-foreground))' }}>Fee ({escrow.house_fee_percent}%): <span style={{ color: 'hsl(var(--primary))' }}>${(escrow.house_fee || 0).toFixed(2)}</span></span>
              <span style={{ color: 'hsl(var(--muted-foreground))' }}>Net: <span style={{ color: 'hsl(142, 76%, 36%)' }}>${(escrow.net_amount || escrow.amount).toFixed(2)}</span></span>
            </div>

            {(escrow.status === 'pending' || escrow.status === 'disputed') && (
              <div className="flex items-center gap-2 mt-2 pt-2" style={{ borderTop: '1px solid hsl(var(--border))' }}>
                {selectedEscrow === escrow.id ? (
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={resolutionNote}
                      onChange={e => setResolutionNote(e.target.value)}
                      placeholder="Resolution note (optional)"
                      className="w-full p-2 rounded-md font-mono text-[10px] focus:outline-none"
                      style={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleResolve(escrow.id, 'released')}
                        className="flex-1 py-1.5 font-mono text-[10px] uppercase rounded-sm"
                        style={{ background: 'hsl(142, 76%, 36%)', color: 'white' }}
                      >
                        Release
                      </button>
                      <button
                        onClick={() => handleResolve(escrow.id, 'refunded')}
                        className="flex-1 py-1.5 font-mono text-[10px] uppercase rounded-sm"
                        style={{ background: 'hsl(200, 80%, 50%)', color: 'white' }}
                      >
                        Refund
                      </button>
                      <button
                        onClick={() => { setSelectedEscrow(null); setResolutionNote(''); }}
                        className="px-2 py-1.5 font-mono text-[10px] uppercase rounded-sm"
                        style={{ border: '1px solid hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setSelectedEscrow(escrow.id)}
                    className="px-3 py-1.5 font-mono text-[10px] uppercase rounded-sm"
                    style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
                  >
                    Resolve
                  </button>
                )}
              </div>
            )}

            {escrow.resolved_by && (
              <div className="mt-2 pt-1" style={{ borderTop: '1px solid hsl(var(--border))' }}>
                <p className="font-mono text-[9px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  Resolved by {escrow.resolved_by} · {new Date(escrow.resolved_at || 0).toLocaleDateString()}
                  {escrow.resolution_note ? ` · "${escrow.resolution_note}"` : ''}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ColorSlider({
  label, icon: Icon, value, min, max, unit = '', onChange, gradient,
}: {
  label: string; icon: React.ElementType; value: number; min: number; max: number;
  unit?: string; onChange: (val: number) => void; gradient?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={12} style={{ color: 'hsl(var(--muted-foreground))' }} />
          <span className="font-mono text-xs" style={{ color: 'hsl(var(--card-foreground))' }}>{label}</span>
        </div>
        <span className="font-mono text-[10px]" style={{ color: 'hsl(var(--primary))' }}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ background: gradient || 'linear-gradient(to right, hsl(var(--muted)), hsl(var(--primary)))' }}
      />
    </div>
  );
}

function ToggleRow({ item, onToggle, accent = false }: { item: ToggleSetting; onToggle: (id: string) => void; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between p-3 border rounded-lg transition-all hover:brightness-110" style={{ borderColor: accent ? 'hsl(var(--primary) / 0.3)' : 'hsl(var(--border))', background: 'hsl(var(--background))' }}>
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-sm" style={{ background: item.enabled ? (accent ? 'hsl(var(--primary) / 0.2)' : 'hsl(var(--primary) / 0.12)') : 'hsl(var(--muted))' }}>
          <item.icon size={16} style={{ color: item.enabled ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }} />
        </div>
        <div>
          <h3 className="font-mono text-sm" style={{ color: 'hsl(var(--card-foreground))' }}>{item.label}</h3>
          <p className="font-mono text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>{item.description}</p>
        </div>
      </div>
      <button onClick={() => onToggle(item.id)} className="relative w-10 h-5 rounded-full transition-colors" style={{ background: item.enabled ? 'hsl(var(--primary))' : 'hsl(var(--muted))' }}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-transform ${item.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} style={{ background: 'hsl(var(--primary-foreground))' }} />
      </button>
    </div>
  );
}

export default function SettingsTab() {
  const { userRole, theme, updateTheme, resetTheme, userHandle } = useApp();
  const isModerator = userRole === 'moderator' || userRole === 'admin';
  const isAdmin = userRole === 'admin';

  const [settings, setSettings] = useState<ToggleSetting[]>([
    { id: 'notifications', label: 'Notifications', description: 'Alert on new encrypted messages', icon: Bell, enabled: true },
    { id: 'burn_default', label: 'Burn by Default', description: 'Auto-enable burn-after-read on all sent messages', icon: Eye, enabled: false },
    { id: 'tor_only', label: 'Tor Only', description: 'Block all non-Tor network traffic', icon: Globe, enabled: true },
    { id: 'sound', label: 'Sound Effects', description: 'Play tones on message events', icon: Volume2, enabled: false },
    { id: 'forward_secrecy', label: 'Forward Secrecy', description: 'Rotate keys after every session', icon: Shield, enabled: true },
  ]);

  const [moderatorSettings, setModeratorSettings] = useState<ToggleSetting[]>([
    { id: 'content_filter', label: 'Content Filter', description: 'Auto-flag suspicious posts and messages', icon: ShieldCheck, enabled: true },
    { id: 'user_reports', label: 'User Reports', description: 'Review and action user-submitted reports', icon: UserCog, enabled: false },
    { id: 'announcements', label: 'Announcements', description: 'Post network-wide announcements to News', icon: Radio, enabled: false },
    { id: 'suspend_users', label: 'User Suspension', description: 'Temporarily suspend flagged accounts', icon: UserX, enabled: false },
  ]);

  const [adminSettings, setAdminSettings] = useState<ToggleSetting[]>([
    { id: 'global_lockdown', label: 'Global Lockdown', description: 'Disable all non-admin communication channels', icon: Lock, enabled: false },
    { id: 'key_rotation', label: 'Auto Key Rotation', description: 'Rotate encryption keys every 6 hours', icon: KeyRound, enabled: true },
    { id: 'intercept_mode', label: 'Intercept Mode', description: 'Log all encrypted traffic for analysis', icon: Radio, enabled: false },
    { id: 'ghost_protocol', label: 'Ghost Protocol', description: 'Auto-burn all messages on session end', icon: UserX, enabled: false },
  ]);

  const [moderatorPrivileges, setModeratorPrivileges] = useState({
    content_filter: true,
    user_reports: true,
    announcements: false,
    suspend_users: false,
  });

  const toggle = (id: string) => setSettings(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  const toggleMod = (id: string) => setModeratorSettings(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  const toggleAdmin = (id: string) => setAdminSettings(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  const togglePrivilege = (key: keyof typeof moderatorPrivileges) => setModeratorPrivileges(prev => ({ ...prev, [key]: !prev[key] }));

  const h = theme.accentHue, s = theme.accentSat, bg = theme.bgDarkness, panel = Math.min(bg + theme.panelBrightness * 0.5, 20), t = theme.textBrightness;

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'hsl(var(--background))' }}>
      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin p-3 md:p-6 min-h-0">
        <div className="mb-6">
          <h2 className="font-serif text-3xl tracking-wider mb-1" style={{ color: 'hsl(var(--foreground))' }}>SETTINGS</h2>
          <p className="font-mono text-xs tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>// {userRole.toUpperCase()} ACCESS // PREFERENCES & SECURITY //</p>
        </div>

        {/* Profile & Identity */}
        <DropdownSection title="Profile & Identity" subtitle="// HANDLE & AVATAR //" icon={User}>
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between p-3 border rounded-lg" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--background))' }}>
              <div>
                <h3 className="font-mono text-sm" style={{ color: 'hsl(var(--card-foreground))' }}>User Handle</h3>
                <p className="font-mono text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>Your public identifier on the network</p>
              </div>
              <span className="font-mono text-xs px-3 py-1.5 rounded-sm border" style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}>{userHandle}</span>
            </div>
            <p className="font-mono text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>Change your handle or avatar from the Profile tab</p>
          </div>
        </DropdownSection>

        {/* Appearance */}
        <DropdownSection title="Appearance" subtitle="// THEME & COLORS //" icon={Palette} defaultOpen>
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <button onClick={resetTheme} className="flex items-center gap-1 px-2 py-1 border rounded-sm font-mono text-[10px] transition-all hover:brightness-125" style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}>
                <RotateCcw size={10} /> Reset
              </button>
              <button onClick={() => updateTheme({ darkMode: !theme.darkMode })} className="flex items-center gap-2 px-3 py-1.5 border rounded-sm font-mono text-[10px] transition-all hover:brightness-125" style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}>
                <Moon size={12} /> {theme.darkMode ? 'Dark' : 'Light'}
              </button>
            </div>
            <ColorSlider label="Accent Color" icon={Droplets} value={h} min={0} max={360} unit="°" gradient={`linear-gradient(to right, hsl(0,${s}%,50%), hsl(60,${s}%,50%), hsl(120,${s}%,50%), hsl(180,${s}%,50%), hsl(240,${s}%,50%), hsl(300,${s}%,50%), hsl(360,${s}%,50%))`} onChange={(v) => updateTheme({ accentHue: v })} />
            <ColorSlider label="Accent Intensity" icon={Sparkles} value={s} min={0} max={100} unit="%" gradient={`linear-gradient(to right, hsl(${h},0%,50%), hsl(${h},100%,50%))`} onChange={(v) => updateTheme({ accentSat: v })} />
            <ColorSlider label="Background Darkness" icon={Moon} value={bg} min={2} max={20} unit="%" gradient="linear-gradient(to right, #050505, #333333)" onChange={(v) => updateTheme({ bgDarkness: v })} />
            <ColorSlider label="Background Tint" icon={Droplets} value={theme.bgSaturation} min={0} max={15} unit="%" gradient={`linear-gradient(to right, hsl(${h},0%,${bg}%), hsl(${h},15%,${bg}%))`} onChange={(v) => updateTheme({ bgSaturation: v })} />
            <ColorSlider label="Panel Brightness" icon={Sun} value={theme.panelBrightness} min={0} max={20} unit="%" gradient="linear-gradient(to right, #0A0A0A, #2A2A2A)" onChange={(v) => updateTheme({ panelBrightness: v })} />
            <ColorSlider label="Panel Tint" icon={Sparkles} value={theme.panelSaturation} min={0} max={15} unit="%" gradient={`linear-gradient(to right, hsl(${h},0%,${panel}%), hsl(${h},15%,${panel}%))`} onChange={(v) => updateTheme({ panelSaturation: v })} />
            <ColorSlider label="Text Brightness" icon={Type} value={t} min={60} max={98} unit="%" gradient="linear-gradient(to right, #666666, #F5F5F5)" onChange={(v) => updateTheme({ textBrightness: v })} />
            <ColorSlider label="Sent Bubble Tint" icon={MessageSquare} value={theme.sentBubbleTint} min={0} max={100} unit="%" gradient={`linear-gradient(to right, hsl(${h},${Math.max(s-40,0)}%,${panel}%), hsl(${h},${s}%,${Math.min(panel+15,35)}%))`} onChange={(v) => updateTheme({ sentBubbleTint: v })} />
            <ColorSlider label="Received Bubble Tint" icon={MessageCircle} value={theme.receivedBubbleTint} min={0} max={100} unit="%" gradient={`linear-gradient(to right, hsl(0,0%,${panel}%), hsl(0,0%,${Math.min(panel+10,30)}%))`} onChange={(v) => updateTheme({ receivedBubbleTint: v })} />
            <ColorSlider label="Border Opacity" icon={Square} value={theme.borderOpacity} min={0} max={100} unit="%" gradient={`linear-gradient(to right, transparent, hsl(${h},${s}%,42%))`} onChange={(v) => updateTheme({ borderOpacity: v })} />
            <ColorSlider label="Outline Width" icon={Minus} value={theme.outlineWidth} min={0} max={3} unit="px" gradient={`linear-gradient(to right, hsl(${h},0%,10%), hsl(${h},${s}%,42%))`} onChange={(v) => updateTheme({ outlineWidth: v })} />
            <ColorSlider label="Message Text Brightness" icon={AlignLeft} value={theme.msgTextBrightness} min={60} max={98} unit="%" gradient="linear-gradient(to right, #555555, #F0F0F0)" onChange={(v) => updateTheme({ msgTextBrightness: v })} />

            <div className="mt-2 grid grid-cols-6 gap-2">
              <div className="h-10 rounded-md border flex items-center justify-center" style={{ background: `hsl(${h},${theme.bgSaturation}%,${bg}%)`, borderColor: `hsl(0,0%,${Math.min(bg+8,30)}%)` }}><span className="font-mono text-[8px]" style={{ color: `hsl(0,0%,${t}%)` }}>Bg</span></div>
              <div className="h-10 rounded-md border flex items-center justify-center" style={{ background: `hsl(${h},${theme.panelSaturation}%,${panel}%)`, borderColor: `hsl(0,0%,${Math.min(bg+8,30)}%)` }}><span className="font-mono text-[8px]" style={{ color: `hsl(0,0%,${t}%)` }}>Panel</span></div>
              <div className="h-10 rounded-md border flex items-center justify-center" style={{ background: `hsl(${h},${s}%,42%)`, borderColor: `hsl(${h},${s}%,60%)` }}><span className="font-mono text-[8px] text-white">Accent</span></div>
              <div className="h-10 rounded-md border flex items-center justify-center" style={{ background: `hsl(${h},${Math.max(s-theme.sentBubbleTint*0.5,10)}%,${Math.min(panel+theme.sentBubbleTint*0.15,18)}%)`, border: `${theme.outlineWidth}px solid hsl(${h},${s}%,42%,${theme.borderOpacity/100})` }}><span className="font-mono text-[8px]" style={{ color: `hsl(0,0%,${theme.msgTextBrightness}%)` }}>Sent</span></div>
              <div className="h-10 rounded-md border flex items-center justify-center" style={{ background: `hsl(0,${Math.max(theme.panelSaturation-theme.receivedBubbleTint*0.3,0)}%,${Math.min(panel+theme.receivedBubbleTint*0.1,16)}%)`, border: `${theme.outlineWidth}px solid hsl(0,0%,${Math.min(bg+theme.panelBrightness+10,35)}%,${theme.borderOpacity/100})` }}><span className="font-mono text-[8px]" style={{ color: `hsl(0,0%,${theme.msgTextBrightness}%)` }}>Recv</span></div>
              <div className="h-10 rounded-md border flex items-center justify-center" style={{ background: `hsl(${h},${theme.bgSaturation}%,${bg}%)`, borderColor: `hsl(0,0%,${Math.min(bg+8,30)}%)` }}><span className="font-mono text-[10px]" style={{ color: `hsl(0,0%,${t}%)` }}>Aa</span></div>
            </div>
          </div>
        </DropdownSection>

        {/* Security */}
        <DropdownSection title="Security" subtitle="// PRIVACY & ENCRYPTION //" icon={Shield} defaultOpen>
          <div className="space-y-3 pt-2">
            {settings.map((item) => (
              <ToggleRow key={item.id} item={item} onToggle={toggle} />
            ))}
            <div className="p-3 border rounded-lg" style={{ borderColor: 'hsl(var(--destructive) / 0.3)', background: 'hsl(var(--background))' }}>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={12} style={{ color: 'hsl(var(--destructive))' }} />
                <span className="font-mono text-[10px] uppercase" style={{ color: 'hsl(var(--destructive))' }}>Warning</span>
              </div>
              <p className="font-mono text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>Disabling Tor Only or Forward Secrecy may expose your traffic to network analysis.</p>
            </div>
            <div className="p-3 border rounded-lg" style={{ borderColor: 'hsl(142, 76%, 36%)', background: 'hsl(var(--background))' }}>
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle size={12} style={{ color: 'hsl(142, 76%, 36%)' }} />
                <span className="font-mono text-[10px] uppercase" style={{ color: 'hsl(142, 76%, 36%)' }}>Security Audit</span>
              </div>
              <p className="font-mono text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>All systems operational. Encryption verified. No anomalies detected in last 72 hours.</p>
            </div>
          </div>
        </DropdownSection>

        {/* MODERATOR */}
        {isModerator && (
          <DropdownSection title="Moderator Controls" subtitle="// MOD PRIVILEGES //" icon={ShieldCheck} accent>
            <div className="space-y-3 pt-2">
              {moderatorSettings.map((item) => (
                <ToggleRow key={item.id} item={item} onToggle={toggleMod} accent />
              ))}
            </div>
          </DropdownSection>
        )}

        {/* ADMIN */}
        {isAdmin && (
          <>
            <DropdownSection title="Moderator Access Control" subtitle="// ASSIGN MOD PRIVILEGES //" icon={UserPlus} accent>
              <div className="space-y-3 pt-2">
                {[
                  { key: 'content_filter' as const, label: 'Content Filter', description: 'Allow moderators to filter flagged content' },
                  { key: 'user_reports' as const, label: 'User Reports', description: 'Allow moderators to review user reports' },
                  { key: 'announcements' as const, label: 'Announcements', description: 'Allow moderators to post network announcements' },
                  { key: 'suspend_users' as const, label: 'User Suspension', description: 'Allow moderators to suspend flagged accounts' },
                ].map((priv) => (
                  <div key={priv.key} className="flex items-center justify-between p-3 border rounded-lg transition-all hover:brightness-110" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--background))' }}>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-sm" style={{ background: moderatorPrivileges[priv.key] ? 'hsl(var(--primary) / 0.12)' : 'hsl(var(--muted))' }}>
                        <UserCog size={16} style={{ color: moderatorPrivileges[priv.key] ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }} />
                      </div>
                      <div>
                        <h3 className="font-mono text-sm" style={{ color: 'hsl(var(--card-foreground))' }}>{priv.label}</h3>
                        <p className="font-mono text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>{priv.description}</p>
                      </div>
                    </div>
                    <button onClick={() => togglePrivilege(priv.key)} className="relative w-10 h-5 rounded-full transition-colors" style={{ background: moderatorPrivileges[priv.key] ? 'hsl(var(--primary))' : 'hsl(var(--muted))' }}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-transform ${moderatorPrivileges[priv.key] ? 'translate-x-5' : 'translate-x-0.5'}`} style={{ background: 'hsl(var(--primary-foreground))' }} />
                    </button>
                  </div>
                ))}
              </div>
            </DropdownSection>

            <DropdownSection title="House Escrow" subtitle="// FEE COLLECTION & WALLET CONFIG //" icon={Landmark} accent>
              <HouseEscrowSettings />
            </DropdownSection>

            <DropdownSection title="Escrow Oversight" subtitle="// ADMIN TRANSACTION ARBITRATION //" icon={Gavel} accent>
              <AdminEscrowOversight />
            </DropdownSection>

            <DropdownSection title="Administrator Controls" subtitle="// SYSTEM-LEVEL PRIVILEGES //" icon={Zap} accent>
              <div className="space-y-3 pt-2">
                {adminSettings.map((item) => (
                  <ToggleRow key={item.id} item={item} onToggle={toggleAdmin} accent />
                ))}
              </div>
            </DropdownSection>

            <DropdownSection title="User Promotion" subtitle="// PROMOTE/DEMOTE MEMBERS //" icon={Crown} accent>
              <UserPromotion />
            </DropdownSection>

            <DropdownSection title="System Operations" subtitle="// DANGER ZONE //" icon={Trash2} accent>
              <div className="space-y-3 pt-2">
                <button
                  onClick={() => {
                    if (window.confirm('BURN ALL GENERAL CHAT MESSAGES? THIS CANNOT BE UNDONE.')) {
                      fetch('/api/open-chat/clear', { method: 'DELETE' })
                        .then(() => alert('// GENERAL CHAT CLEARED //'))
                        .catch(() => alert('// CLEAR FAILED //'));
                    }
                  }}
                  className="w-full p-4 border rounded-lg flex items-center gap-3 transition-all hover:brightness-110"
                  style={{ borderColor: 'hsl(var(--destructive) / 0.3)', background: 'hsl(var(--background))' }}
                >
                  <div className="p-2 rounded-sm" style={{ background: 'hsl(var(--destructive) / 0.12)' }}>
                    <Trash2 size={16} style={{ color: 'hsl(var(--destructive))' }} />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="font-mono text-sm" style={{ color: 'hsl(var(--destructive))' }}>Clear General Chat</h3>
                    <p className="font-mono text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>Permanently delete all open chat messages</p>
                  </div>
                </button>
              </div>
            </DropdownSection>

            <div className="mt-4 p-4 border rounded-lg max-w-2xl" style={{ borderColor: 'hsl(var(--primary) / 0.3)', background: 'hsl(var(--card))' }}>
              <div className="flex items-center gap-2 mb-2">
                <Unlock size={14} style={{ color: 'hsl(var(--primary))' }} />
                <h3 className="font-mono text-xs uppercase tracking-wider" style={{ color: 'hsl(var(--primary))' }}>Admin Status</h3>
              </div>
              <p className="font-mono text-[11px]" style={{ color: 'hsl(var(--muted-foreground))' }}>You are operating with full system privileges. All audit actions are logged to the operations console.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function UserPromotion() {
  const { searchUsers, userProfiles, fetchUserProfile } = useApi();
  const { userHandle } = useApp();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<{id: number; handle: string; role?: string; created_at: number}[]>([]);
  const [promoting, setPromoting] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  useEffect(() => {
    if (search.length > 0) {
      const t = setTimeout(() => {
        searchUsers(search).then(data => setResults(data));
      }, 200);
      return () => clearTimeout(t);
    } else {
      setResults([]);
    }
  }, [search, searchUsers]);

  useEffect(() => {
    results.forEach(u => {
      if (u.handle && !userProfiles[u.handle]) fetchUserProfile(u.handle);
    });
  }, [results, fetchUserProfile, userProfiles]);

  const promote = async (handle: string, role: 'basic' | 'moderator' | 'admin') => {
    setPromoting(handle);
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(handle)}/promote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, adminHandle: userHandle })
      });
      if (res.ok) {
        showToast(`// ${handle} PROMOTED TO ${role.toUpperCase()} //`);
        // Refresh results to show updated role
        if (search.length > 0) {
          const data = await searchUsers(search);
          setResults(data);
        }
        // Refresh profile data
        fetchUserProfile(handle);
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(`// FAILED: ${data.error || 'Unauthorized'} //`);
      }
    } catch {
      showToast('// NETWORK ERROR //');
    }
    setPromoting(null);
  };

  return (
    <div className="space-y-3 pt-2">
      {/* Search */}
      <div className="flex items-center gap-2 p-2 border rounded-md" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--background))' }}>
        <Search size={14} style={{ color: 'hsl(var(--muted-foreground))' }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search user to promote..."
          className="flex-1 bg-transparent font-mono text-xs focus:outline-none placeholder:text-noir-500"
          style={{ color: 'hsl(var(--foreground))' }}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{ color: 'hsl(var(--muted-foreground))' }}>
            <X size={12} />
          </button>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {results.map(user => {
            const profile = userProfiles[user.handle];
            const role = user.role || 'basic';
            return (
              <div key={user.id} className="flex items-center gap-3 p-2.5 border rounded-lg" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--card))' }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-serif text-xs font-bold text-white overflow-hidden" style={{ background: 'hsl(var(--primary))' }}>
                  {profile?.avatar ? <img src={profile.avatar} alt="" className="w-full h-full object-cover" /> : user.handle.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs truncate" style={{ color: 'hsl(var(--foreground))' }}>{user.handle}</span>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded-sm uppercase whitespace-nowrap" style={{
                      background: role === 'admin' ? 'hsl(var(--primary) / 0.3)' : role === 'moderator' ? 'hsl(45, 100%, 50% / 0.3)' : 'hsl(var(--muted) / 0.3)',
                      color: role === 'admin' ? 'hsl(var(--primary))' : role === 'moderator' ? 'hsl(45, 100%, 50%)' : 'hsl(var(--muted-foreground))'
                    }}>{role}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => promote(user.handle, 'basic')}
                    disabled={promoting === user.handle || role === 'basic'}
                    className="px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider border rounded-sm transition-all hover:brightness-110 disabled:opacity-40 whitespace-nowrap"
                    style={role === 'basic' 
                      ? { borderColor: 'hsl(var(--muted))', background: 'hsl(var(--muted) / 0.3)', color: 'hsl(var(--muted-foreground))' }
                      : { borderColor: 'hsl(var(--muted) / 0.4)', color: 'hsl(var(--muted-foreground))' }
                    }
                  >Basic</button>
                  <button
                    onClick={() => promote(user.handle, 'moderator')}
                    disabled={promoting === user.handle || role === 'moderator'}
                    className="px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider border rounded-sm transition-all hover:brightness-110 disabled:opacity-40 whitespace-nowrap"
                    style={role === 'moderator'
                      ? { borderColor: 'hsl(45, 100%, 50%)', background: 'hsl(45, 100%, 50% / 0.2)', color: 'hsl(45, 100%, 50%)' }
                      : { borderColor: 'hsl(45, 100%, 50% / 0.4)', color: 'hsl(45, 100%, 50%)' }
                    }
                  >Mod</button>
                  <button
                    onClick={() => promote(user.handle, 'admin')}
                    disabled={promoting === user.handle || role === 'admin'}
                    className="px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider border rounded-sm transition-all hover:brightness-110 disabled:opacity-40 whitespace-nowrap"
                    style={role === 'admin'
                      ? { borderColor: 'hsl(var(--primary))', background: 'hsl(var(--primary) / 0.2)', color: 'hsl(var(--primary))' }
                      : { borderColor: 'hsl(var(--primary) / 0.4)', color: 'hsl(var(--primary))' }
                    }
                  >Admin</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="px-3 py-2 font-mono text-[10px] border rounded-sm" style={{ borderColor: 'hsl(var(--primary) / 0.4)', color: 'hsl(var(--primary))', background: 'hsl(var(--card))' }}>{toast}</div>
      )}
    </div>
  );
}
