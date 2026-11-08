import { Store, Hammer } from 'lucide-react';

export default function MrktTab() {
  return (
    <div className="h-full flex flex-col items-center justify-center px-6" style={{ background: 'hsl(var(--background))' }}>
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border mb-2" style={{ borderColor: 'hsl(var(--primary) / 0.3)', background: 'hsl(var(--primary) / 0.08)' }}>
          <Hammer size={28} style={{ color: 'hsl(var(--primary))' }} />
        </div>
        <h2 className="font-serif text-2xl tracking-wider" style={{ color: 'hsl(var(--foreground))' }}>// MRKT //</h2>
        <p className="font-mono text-xs tracking-wider max-w-[280px] mx-auto" style={{ color: 'hsl(var(--muted-foreground))' }}>
          Auction marketplace coming soon.<br />
          Buy, sell, and bid with escrow protection.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-sm border font-mono text-[10px] uppercase tracking-widest" style={{ borderColor: 'hsl(var(--primary) / 0.3)', color: 'hsl(var(--primary) / 0.7)' }}>
          <Store size={12} /> Under Construction
        </div>
      </div>
    </div>
  );
}
