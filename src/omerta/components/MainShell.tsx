import { useApp } from '@omerta/store/AppContext';
import {
  User, MessageCircle, Users, MessageSquare, ShieldCheck, Settings, LogOut, Globe,
  Terminal, Store,
} from 'lucide-react';


import ProfileTab from './tabs/ProfileTab';
import ChatTab from './tabs/ChatTab';
import ContactsTab from './tabs/ContactsTab';
import MessageTab from './tabs/MessageTab';
import EscrowTab from './tabs/EscrowTab';
import SettingsTab from './tabs/SettingsTab';
import SynTab from './tabs/SynTab';
import MrktTab from './tabs/MrktTab';

const BASE_TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'news', label: 'News', icon: Globe },
  { id: 'chat', label: 'Chat', icon: MessageCircle },
  { id: 'message', label: 'Message', icon: MessageSquare },
  { id: 'contacts', label: 'Contacts', icon: Users },
  { id: 'escrow', label: 'Escrow', icon: ShieldCheck },
  { id: 'mrkt', label: 'MRKT', icon: Store },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function NotificationBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center px-1 rounded-full text-[9px] font-mono font-bold text-white z-10"
      style={{ background: 'hsl(var(--destructive))', fontSize: '9px' }}>
      {count > 9 ? '9+' : count}
    </span>
  );
}

export default function MainShell() {
  const {
    logout, userRole,
    unreadCounts, activeTab, setActiveTab, setViewingProfile,
    requestNotificationPermission,
  } = useApp();
  const isAdmin = userRole === 'admin';
  const isModerator = userRole === 'moderator';

  const TABS = [
    ...BASE_TABS,
    ...(isAdmin || isModerator ? [{ id: 'syn', label: 'Syn', icon: Terminal }] : []),
  ];

  const renderTab = () => {
    switch (activeTab) {
      case 'profile': return <ProfileTab mode="own" />;
      case 'news': return <ProfileTab mode="feed" />;
      case 'chat': return <ChatTab />;
      case 'contacts': return <ContactsTab />;
      case 'message': return <MessageTab />;
      case 'escrow': return <EscrowTab />;
      case 'mrkt': return <MrktTab />;
      case 'settings': return <SettingsTab />;
      case 'syn': return <SynTab />;
      default: return <ProfileTab />;
    }
  };

  const handleTabClick = (tabId: string) => {
    setViewingProfile(null);
    setActiveTab(tabId);
    requestNotificationPermission();
  };

  return (
    <div className="safe-shell flex h-full w-full min-h-0 relative" style={{ background: 'hsl(var(--background))' }}>
      {/* Left Tab Bar */}
      <div className="w-12 md:w-16 flex-shrink-0 flex flex-col items-center py-2 md:py-4 border-r z-10 overflow-y-auto scrollbar-hide" style={{ background: 'hsl(var(--sidebar-background))', borderColor: 'hsl(var(--sidebar-border))' }}>
        {/* Logo */}
        <div className="mb-2 md:mb-5 relative">
          <div className="w-8 h-8 md:w-12 md:h-12 rounded-full overflow-hidden" style={{ background: 'transparent' }}>
            <img
              src="/logo.jpg"
              alt="Omerta"
              className="w-full h-full object-cover opacity-90 hover:opacity-100 transition-all select-none"
              draggable={false}
              style={{ background: 'transparent' }}
            />
          </div>
          {/* Privilege indicator dot */}
          {isAdmin && (
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 animate-pulse" style={{ background: 'hsl(var(--destructive))', borderColor: 'hsl(var(--sidebar-background))' }} title="ADMIN" />
          )}
          {isModerator && !isAdmin && (
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 animate-pulse" style={{ background: '#F59E0B', borderColor: 'hsl(var(--sidebar-background))' }} title="MODERATOR" />
          )}
        </div>

        {/* Tab Buttons */}
        <div className="flex flex-col items-center gap-1 flex-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const unreadKey = tab.id as keyof typeof unreadCounts;
            const unreadCount = unreadCounts[unreadKey] || 0;

            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className="relative w-9 h-9 md:w-11 md:h-11 flex flex-col items-center justify-center rounded-md transition-all group"
                style={{
                  background: isActive ? 'hsl(var(--sidebar-accent))' : 'transparent',
                  color: isActive ? 'hsl(var(--sidebar-accent-foreground))' : 'hsl(var(--sidebar-foreground) / 0.6)',
                }}
                title={tab.label}
              >
                <Icon size={18} className="transition-all group-hover:scale-110" />
                <span className="font-mono text-[7px] mt-0.5 opacity-60 group-hover:opacity-100 uppercase tracking-wider">{tab.label.slice(0, 4)}</span>
                <NotificationBadge count={unreadCount} />
              </button>
            );
          })}
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          className="w-10 h-10 flex items-center justify-center rounded-md transition-all mt-2"
          style={{ color: 'hsl(var(--sidebar-foreground) / 0.4)' }}
          title="Logout"
        >
          <LogOut size={16} />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0 overflow-hidden relative">
        {renderTab()}
      </div>


 

    </div>
  );
}



