import { useState, useEffect } from 'react';
import { useApp } from '@omerta/store/AppContext';
import { useApi } from '@omerta/store/ApiContext';
import { payHouseCut, recordHouseTx } from '@omerta/chain';
import {
  ShieldCheck, Lock, Unlock, AlertTriangle, X,
  Clock, ArrowRight,
} from 'lucide-react';

interface Toast { id: number; text: string; type: 'success' | 'error'; }

const STATUS_COLORS: Record<string, { bg: string; text: string; icon: typeof Lock }> = {
  pending: { bg: 'hsl(45, 90%, 40%)', text: '#FBBF24', icon: Clock },
  released: { bg: 'hsl(142, 76%, 36%)', text: '#4ADE80', icon: Unlock },
  disputed: { bg: 'hsl(0, 84%, 42%)', text: '#F87171', icon: AlertTriangle },
  cancelled: { bg: 'hsl(0, 0%, 40%)', text: '#9CA3AF', icon: X },
};

export default function EscrowTab() {
  const { userHandle } = useApp();
  const { escrows, fetchEscrows, createEscrow, updateEscrow, houseSettings, fetchHouseSettings } = useApi();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (userHandle) fetchEscrows(userHandle);
  }, [userHandle, fetchEscrows]);

  useEffect(() => {
    fetchHouseSettings();
  }, [fetchHouseSettings]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    const t = { id: Date.now(), text, type };
    setToasts(prev => [...prev, t]);
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), 2500);
  };

  const handleCreate = async () => {
    if (!recipient.trim() || !amount || Number(amount) <= 0) {
      showToast('// RECIPIENT AND AMOUNT REQUIRED //', 'error');
      return;
    }
    setLoading(true);
    const created = await createEscrow(userHandle, recipient.trim(), Number(amount), description);
    await fetchEscrows(userHandle);
    setLoading(false);
    setShowCreate(false);
    setRecipient(''); setAmount(''); setDescription('');
    const fee = Number((Number(amount) * 0.03).toFixed(2));
    if (houseSettings.feeWallet && fee > 0) {
      try {
        const result = await payHouseCut(houseSettings.chain || 'base', houseSettings.feeWallet, fee);
        if (result.tx && created?.id) await recordHouseTx(String(created.id), result.tx);
        if (result.tx) showToast('House cut sent on chain');
        else if (result.opened) showToast('Approve the USDC transfer in your wallet');
        else showToast(result.error || '// ESCROW CREATED //');
      } catch {
        showToast('The wallet refused the house cut', 'error');
      }
    } else {
      showToast('// ESCROW CREATED //');
    }
  };

  const handleAction = async (id: string, action: 'release' | 'dispute' | 'cancel') => {
    const row = escrows.find((item) => item.id === id);
    await updateEscrow(id, action);
    await fetchEscrows(userHandle);
    const house = await fetch('/api/house/settings').then((response) => response.json()).catch(() => null);
    const alreadySent = (house?.payments || []).some((row: { source_id: string; status: string }) => row.source_id === id && row.status === 'sent');
    if ((action === 'release' || action === 'cancel') && !alreadySent && row && String(row.sender).toLowerCase() === userHandle.trim().toLowerCase() && houseSettings.feeWallet) {
      const fee = Number((Number(row.amount) * 0.03).toFixed(2));
      try {
        const result = await payHouseCut(houseSettings.chain || 'base', houseSettings.feeWallet, fee);
        if (result.tx) await recordHouseTx(id, result.tx);
        if (result.tx) showToast('House cut sent on chain');
        else if (result.opened) showToast('Approve the USDC transfer in your wallet');
        else showToast(result.error || 'Wallet did not open', 'error');
      } catch {
        showToast('The wallet refused the transfer', 'error');
      }
      return;
    }
    showToast(`// ESCROW ${action.toUpperCase()}D //`);
  };

  const totalPending = escrows.filter(e => e.status === 'pending').reduce((s, e) => s + e.amount, 0);
  const totalReleased = escrows.filter(e => e.status === 'released').reduce((s, e) => s + e.amount, 0);

  return (
    <div className="h-full flex flex-col p-3 md:p-6 overflow-y-auto overflow-x-hidden scrollbar-thin bg-noir-950">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-serif text-3xl text-white tracking-wider mb-1">ESCROW</h2>
          <p className="font-mono text-xs text-noir-500 tracking-wider">// SECURE TRANSACTIONS //</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 font-mono text-xs uppercase tracking-wider rounded-sm transition-all"
          style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
        >
          {showCreate ? 'Cancel' : 'New Escrow'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-5 max-w-2xl">
        <div className="p-3 border rounded-lg" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--card))' }}>
          <div className="flex items-center gap-2 mb-1">
            <Clock size={12} style={{ color: 'hsl(45, 90%, 40%)' }} />
            <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>Pending</span>
          </div>
          <span className="font-mono text-lg text-white">${totalPending.toFixed(2)}</span>
        </div>
        <div className="p-3 border rounded-lg" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--card))' }}>
          <div className="flex items-center gap-2 mb-1">
            <Unlock size={12} style={{ color: 'hsl(142, 76%, 36%)' }} />
            <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: 'hsl(var(--muted-foreground))' }}>Released</span>
          </div>
          <span className="font-mono text-lg text-white">${totalReleased.toFixed(2)}</span>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="mb-5 p-4 border rounded-lg max-w-2xl" style={{ borderColor: 'hsl(var(--primary) / 0.3)', background: 'hsl(var(--card))' }}>
          <h3 className="font-mono text-xs uppercase tracking-wider mb-3" style={{ color: 'hsl(var(--primary))' }}>New Escrow Transaction</h3>
          <div className="space-y-3">
            <div>
              <label className="font-mono text-[10px] uppercase mb-1 block" style={{ color: 'hsl(var(--muted-foreground))' }}>Recipient Handle</label>
              <input value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="@handle" className="w-full p-2 rounded-md font-mono text-sm focus:outline-none" style={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' }} />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase mb-1 block" style={{ color: 'hsl(var(--muted-foreground))' }}>Amount (USD)</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" min="0" step="0.01" className="w-full p-2 rounded-md font-mono text-sm focus:outline-none" style={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' }} />
              {amount && Number(amount) > 0 && (
                <div className="mt-2 space-y-1 font-mono text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  <div className="flex justify-between">
                    <span>House Fee ({houseSettings.houseFeePercent}%)</span>
                    <span style={{ color: 'hsl(var(--primary))' }}>${(Number(amount) * (houseSettings.houseFeePercent / 100)).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Net to Recipient</span>
                    <span style={{ color: 'hsl(142, 76%, 36%)' }}>${(Number(amount) - (Number(amount) * (houseSettings.houseFeePercent / 100))).toFixed(2)}</span>
                  </div>
                  {houseSettings.holdingWallet && (
                    <div className="flex justify-between">
                      <span>Holding Wallet</span>
                      <span className="truncate max-w-[150px]">{houseSettings.holdingWallet}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase mb-1 block" style={{ color: 'hsl(var(--muted-foreground))' }}>Description</label>
              <input value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this for?" className="w-full p-2 rounded-md font-mono text-sm focus:outline-none" style={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' }} />
            </div>
            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full py-2 font-mono text-xs uppercase tracking-wider rounded-sm disabled:opacity-50"
              style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
            >
              {loading ? 'Creating...' : 'Create Escrow'}
            </button>
          </div>
        </div>
      )}

      {/* Escrow list */}
      <div className="space-y-3 max-w-2xl">
        {escrows.length === 0 && (
          <div className="p-8 border rounded-lg text-center" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--card))' }}>
            <ShieldCheck size={24} style={{ color: 'hsl(var(--muted-foreground))' }} className="mx-auto mb-3" />
            <p className="font-mono text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>No escrow transactions</p>
          </div>
        )}

        {escrows.map(escrow => {
          const status = STATUS_COLORS[escrow.status] || STATUS_COLORS.pending;
          const StatusIcon = status.icon;
          const isSender = escrow.sender === userHandle;

          return (
            <div key={escrow.id} className="p-4 border rounded-lg" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--card))' }}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <StatusIcon size={14} style={{ color: status.text }} />
                  <span className="font-mono text-xs uppercase tracking-wider" style={{ color: status.text }}>{escrow.status}</span>
                </div>
                <span className="font-mono text-lg font-bold text-white">${escrow.amount.toFixed(2)}</span>
              </div>

              <div className="flex items-center gap-2 mb-2 font-mono text-xs">
                <span style={{ color: 'hsl(var(--foreground))' }}>{escrow.sender}</span>
                <ArrowRight size={12} style={{ color: 'hsl(var(--muted-foreground))' }} />
                <span style={{ color: 'hsl(var(--foreground))' }}>{escrow.recipient}</span>
              </div>

              {escrow.description && (
                <p className="font-mono text-[11px] mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>{escrow.description}</p>
              )}

              {/* Fee breakdown */}
              {(escrow.house_fee !== undefined) && (
                <div className="mt-1 mb-2 p-2 rounded-md border" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--background))' }}>
                  <div className="flex justify-between font-mono text-[10px] mb-1">
                    <span style={{ color: 'hsl(var(--muted-foreground))' }}>Total</span>
                    <span style={{ color: 'hsl(var(--foreground))' }}>${escrow.amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-mono text-[10px] mb-1">
                    <span style={{ color: 'hsl(var(--muted-foreground))' }}>House Fee ({escrow.house_fee_percent}%)</span>
                    <span style={{ color: 'hsl(var(--primary))' }}>-${escrow.house_fee?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-mono text-[10px]">
                    <span style={{ color: 'hsl(var(--muted-foreground))' }}>Net to Recipient</span>
                    <span style={{ color: 'hsl(142, 76%, 36%)' }}>${escrow.net_amount?.toFixed(2)}</span>
                  </div>
                  {escrow.resolved_by && (
                    <div className="mt-1 pt-1 border-t" style={{ borderColor: 'hsl(var(--border))' }}>
                      <span className="font-mono text-[9px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
                        Resolved by {escrow.resolved_by} {escrow.resolution_note ? `· ${escrow.resolution_note}` : ''}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Actions for pending escrows */}
              {escrow.status === 'pending' && (
                <div className="flex items-center gap-2 mt-3">
                  {isSender && (
                    <button
                      onClick={() => handleAction(escrow.id, 'cancel')}
                      className="px-3 py-1.5 font-mono text-[10px] uppercase rounded-sm"
                      style={{ border: '1px solid hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}
                    >
                      Cancel
                    </button>
                  )}
                  {!isSender && (
                    <>
                      <button
                        onClick={() => handleAction(escrow.id, 'release')}
                        className="px-3 py-1.5 font-mono text-[10px] uppercase rounded-sm flex items-center gap-1"
                        style={{ background: 'hsl(142, 76%, 36%)', color: 'white' }}
                      >
                        <Unlock size={10} /> Release
                      </button>
                      <button
                        onClick={() => handleAction(escrow.id, 'dispute')}
                        className="px-3 py-1.5 font-mono text-[10px] uppercase rounded-sm flex items-center gap-1"
                        style={{ background: 'hsl(0, 84%, 42%)', color: 'white' }}
                      >
                        <AlertTriangle size={10} /> Dispute
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Toasts */}
      {toasts.map(t => (
        <div key={t.id} className="fixed bottom-6 right-6 px-4 py-2 font-mono text-xs border rounded-sm z-50"
          style={{ borderColor: t.type === 'success' ? 'hsl(var(--primary) / 0.3)' : 'hsl(var(--destructive) / 0.3)', background: 'hsl(var(--card))', color: t.type === 'success' ? 'hsl(var(--primary))' : 'hsl(var(--destructive))' }}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
