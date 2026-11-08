export interface Message {
  id: string;
  content: string;
  sender: string;
  timestamp: number;
  isSent: boolean;
  burnAfterRead: boolean;
  isBurned: boolean;
  isSystem: boolean;
  isEmojiEncrypted: boolean;
  isE2EEncrypted: boolean;
  replyTo?: string;
  replyContent?: string;
  replySender?: string;
  edited?: boolean;
  deleted?: boolean;
}

export interface OpenChatMessage {
  id: string;
  content: string;
  sender: string;
  senderColor: string;
  timestamp: number;
  isEmojiEncrypted: boolean;
  isE2EEncrypted: boolean;
}

export interface Conversation {
  id: string;
  handle: string;
  avatarColor: string;
  lastMessage: string;
  timestamp: number;
  unread: number;
  encrypted: boolean;
  messages: Message[];
}

export interface AppState {
  isAuthenticated: boolean;
  userHandle: string;
  activeConversationId: string | null;
  conversations: Conversation[];
  mobileSidebarOpen: boolean;
  openChatMessages: OpenChatMessage[];
}
