// Strict one-to-one letter↔emoji mapping — ZERO collisions, NO multi-codepoint emojis
const EMOJI_MAP: Record<string, string> = {
  'a': '🔒', 'b': '🗝', 'c': '🛡', 'd': '⚔', 'e': '📵',
  'f': '🔪', 'g': '📡', 'h': '📻', 'i': '🔦', 'j': '🧨',
  'k': '⛓', 'l': '🧿', 'm': '📿', 'n': '🕯', 'o': '📜',
  'p': '🏴', 'q': '☠', 'r': '💀', 's': '🕸', 't': '🦂',
  'u': '🐍', 'v': '🦇', 'w': '🌑', 'x': '⚰', 'y': '🪦',
  'z': '👁',
  'A': '🔐', 'B': '🗡', 'C': '🏰', 'D': '🕳', 'E': '🚫',
  'F': '☣', 'G': '☢', 'H': '📛', 'I': '🔕', 'J': '🤐',
  'K': '🔗', 'L': '🧱', 'M': '🛢', 'N': '⚠', 'O': '📄',
  'P': '🏁', 'Q': '💣', 'R': '🦴', 'S': '🕷', 'T': '🐉',
  'U': '🐺', 'V': '🦉', 'W': '🌚', 'X': '🥀', 'Y': '⚱',
  'Z': '🗿',
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
  '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
  ' ': '▪', '.': '📍', ',': '🔸', '!': '❗', '?': '❓',
  "'": '🔹', '"': '🔶', '-': '➖', '_': '➗', '/': '◾',
  ':': '◼', ';': '◻', '(': '⬛', ')': '⬜', '@': '📧',
  '#': '🔢', '$': '💰', '%': '💯', '&': '⚜', '*': '✦',
  '+': '➕', '=': '🟰', '<': '◀', '>': '▶', '[': '🔲',
  ']': '🔳', '{': '🟥', '}': '🟦', '|': '⬆', '\\': '↗',
  '~': '↘', '`': '↙', '^': '↖',
};

// Build reverse map with duplicate detection
const REVERSE_MAP: Record<string, string> = {};
const seen = new Set<string>();
for (const [char, emoji] of Object.entries(EMOJI_MAP)) {
  if (seen.has(emoji)) {
    throw new Error(`DUPLICATE emoji: "${emoji}" maps to both "${REVERSE_MAP[emoji]}" and "${char}"`);
  }
  seen.add(emoji);
  REVERSE_MAP[emoji] = char;
}

export function emojiEncrypt(text: string): string {
  let out = '';
  for (const ch of text) {
    out += EMOJI_MAP[ch] || ch;
  }
  return out;
}

export function emojiDecrypt(emojiText: string): string | null {
  if (!emojiText) return null;
  let out = '';
  for (const ch of emojiText) {
    const decoded = REVERSE_MAP[ch];
    out += decoded !== undefined ? decoded : ch;
  }
  return out;
}

export function isEmojiEncrypted(text: string): boolean {
  if (!text) return false;
  const sample = text.slice(0, Math.min(20, text.length));
  let mapped = 0, total = 0;
  for (const ch of sample) {
    if (ch.trim()) { total++; if (REVERSE_MAP[ch]) mapped++; }
  }
  return total > 0 && mapped / total > 0.5;
}
