import { useState } from 'react';
import { X, User, Briefcase, MapPin, Link as LinkIcon, Save } from 'lucide-react';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentHandle: string;
  onSave: (profile: { handle: string; bio: string; workplace: string; location: string; link: string }) => void;
}

export default function EditProfileModal({ isOpen, onClose, currentHandle, onSave }: EditProfileModalProps) {
  const [handle, setHandle] = useState(currentHandle);
  const [bio, setBio] = useState('Silent operator. No real names. No traces. No logs.');
  const [workplace, setWorkplace] = useState('Omerta Network');
  const [location, setLocation] = useState('Undisclosed');
  const [link, setLink] = useState('omerta.vault/operatives');

  if (!isOpen) return null;

  const handleSave = () => {
    if (!handle.trim()) return;
    onSave({ handle: handle.trim(), bio, workplace, location, link });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-noir-950 border border-noir-700 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-noir-800">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-1 text-noir-400 hover:text-white transition-colors">
              <X size={20} />
            </button>
            <h2 className="font-serif text-xl text-white tracking-wider">Edit Profile</h2>
          </div>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 bg-blood text-white font-mono text-xs uppercase tracking-wider rounded-md hover:brightness-110 transition-all flex items-center gap-1.5"
          >
            <Save size={12} />
            Save
          </button>
        </div>

        {/* Banner preview */}
        <div className="relative h-24 bg-noir-900">
          <div className="absolute inset-0 opacity-30" style={{
            backgroundImage: 'repeating-linear-gradient(45deg, #1A1A1A 0px, #1A1A1A 2px, transparent 2px, transparent 12px)',
          }} />
        </div>

        {/* Avatar */}
        <div className="px-5 -mt-8 mb-4">
          <div className="w-16 h-16 rounded-full bg-blood border-4 border-noir-950 flex items-center justify-center font-serif text-xl font-bold text-white shadow-lg">
            {handle.slice(0, 2).toUpperCase() || 'AN'}
          </div>
        </div>

        {/* Form */}
        <div className="px-5 pb-6 space-y-4">
          <div>
            <label className="flex items-center gap-1.5 font-mono text-[10px] text-noir-400 uppercase tracking-wider mb-1.5">
              <User size={10} />
              Handle
            </label>
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              className="w-full bg-noir-900 border border-noir-700 rounded-md px-3 py-2 font-mono text-sm text-white focus:outline-none focus:border-blood/40 transition-colors"
            />
          </div>

          <div>
            <label className="font-mono text-[10px] text-noir-400 uppercase tracking-wider mb-1.5 block">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="w-full bg-noir-900 border border-noir-700 rounded-md px-3 py-2 font-mono text-sm text-white focus:outline-none focus:border-blood/40 resize-none transition-colors"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 font-mono text-[10px] text-noir-400 uppercase tracking-wider mb-1.5">
              <Briefcase size={10} />
              Workplace
            </label>
            <input
              type="text"
              value={workplace}
              onChange={(e) => setWorkplace(e.target.value)}
              className="w-full bg-noir-900 border border-noir-700 rounded-md px-3 py-2 font-mono text-sm text-white focus:outline-none focus:border-blood/40 transition-colors"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 font-mono text-[10px] text-noir-400 uppercase tracking-wider mb-1.5">
              <MapPin size={10} />
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-noir-900 border border-noir-700 rounded-md px-3 py-2 font-mono text-sm text-white focus:outline-none focus:border-blood/40 transition-colors"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 font-mono text-[10px] text-noir-400 uppercase tracking-wider mb-1.5">
              <LinkIcon size={10} />
              Link
            </label>
            <input
              type="text"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              className="w-full bg-noir-900 border border-noir-700 rounded-md px-3 py-2 font-mono text-sm text-white focus:outline-none focus:border-blood/40 transition-colors"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
