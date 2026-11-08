import { X, MessageSquare, UserPlus, Eye, ShieldCheck, AtSign, Calendar } from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    handle: string;
    avatar?: string | null;
    initials?: string;
    createdAt?: number;
    isContact?: boolean;
  };
  onMessage?: (handle: string) => void;
  onAddContact?: (handle: string) => void;
  onViewProfile?: (handle: string) => void;
}

export default function UserProfileModal({ isOpen, onClose, user, onMessage, onAddContact, onViewProfile }: UserProfileModalProps) {
  if (!isOpen) return null;

  const displayName = user.handle || 'Unknown';
  const initials = user.initials || displayName.slice(0, 2).toUpperCase();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-xs rounded-xl border shadow-2xl overflow-hidden"
        style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full transition-colors"
          style={{ background: 'hsl(var(--background) / 0.6)', color: 'hsl(var(--muted-foreground))' }}
        >
          <X size={14} />
        </button>

        {/* Enlarged Avatar */}
        <div className="flex flex-col items-center pt-8 pb-5 px-6" style={{ background: 'linear-gradient(180deg, hsl(var(--primary) / 0.15) 0%, hsl(var(--card)) 100%)' }}>
          <div
            className="w-28 h-28 rounded-full border-3 shadow-xl overflow-hidden flex items-center justify-center mb-4"
            style={{ borderColor: 'hsl(var(--primary) / 0.5)', borderWidth: '3px' }}
          >
            {user.avatar ? (
              <img src={user.avatar} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ background: 'hsl(var(--primary))' }}>
                <span className="font-serif text-4xl font-bold text-white">{initials}</span>
              </div>
            )}
          </div>

          <h3 className="font-serif text-xl text-white tracking-wider text-center mb-1">{displayName}</h3>
          <div className="flex items-center gap-1.5">
            <AtSign size={10} style={{ color: 'hsl(var(--muted-foreground))' }} />
            <span className="font-mono text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>@{displayName.toLowerCase()}</span>
          </div>
        </div>

        {/* Info row */}
        <div className="px-5 py-3 border-t" style={{ borderColor: 'hsl(var(--border) / 0.5)' }}>
          <div className="flex items-center justify-center gap-4">
            {user.createdAt && (
              <div className="flex items-center gap-1">
                <Calendar size={10} style={{ color: 'hsl(var(--muted-foreground))' }} />
                <span className="font-mono text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  {new Date(user.createdAt * 1000).toLocaleDateString()}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <ShieldCheck size={10} style={{ color: 'hsl(142, 76%, 36%)' }} />
              <span className="font-mono text-[10px]" style={{ color: 'hsl(142, 76%, 36%)' }}>Verified</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-2 p-4 border-t" style={{ borderColor: 'hsl(var(--border) / 0.5)' }}>
          <button
            onClick={() => { onMessage?.(displayName); onClose(); }}
            className="flex flex-col items-center gap-1.5 py-3 rounded-lg transition-all hover:brightness-110"
            style={{ background: 'hsl(var(--primary) / 0.12)' }}
          >
            <MessageSquare size={18} style={{ color: 'hsl(var(--primary))' }} />
            <span className="font-mono text-[9px] uppercase tracking-wider" style={{ color: 'hsl(var(--primary))' }}>Message</span>
          </button>

          <button
            onClick={() => { onAddContact?.(displayName); onClose(); }}
            className="flex flex-col items-center gap-1.5 py-3 rounded-lg transition-all hover:brightness-110"
            style={{ background: 'hsl(var(--primary) / 0.12)' }}
          >
            <UserPlus size={18} style={{ color: 'hsl(var(--primary))' }} />
            <span className="font-mono text-[9px] uppercase tracking-wider" style={{ color: 'hsl(var(--primary))' }}>Add</span>
          </button>

          <button
            onClick={() => { onViewProfile?.(displayName); onClose(); }}
            className="flex flex-col items-center gap-1.5 py-3 rounded-lg transition-all hover:brightness-110"
            style={{ background: 'hsl(var(--primary) / 0.12)' }}
          >
            <Eye size={18} style={{ color: 'hsl(var(--primary))' }} />
            <span className="font-mono text-[9px] uppercase tracking-wider" style={{ color: 'hsl(var(--primary))' }}>Profile</span>
          </button>
        </div>
      </div>
    </div>
  );
}
