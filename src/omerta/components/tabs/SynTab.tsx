import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '@omerta/store/AppContext';
import { Terminal, AlertTriangle, ShieldCheck, Lock, Play, Trash2 } from 'lucide-react';

interface HistoryEntry {
  id: number;
  type: 'input' | 'output' | 'error' | 'system';
  text: string;
  timestamp: number;
}

const WELCOME = [
  'House terminal. These commands run inside Omertà.',
  'Type help.',
  '',
];

export default function SynTab() {
  const { userRole, userHandle } = useApp();
  const [history, setHistory] = useState<HistoryEntry[]>(
    WELCOME.map((line, i) => ({ id: i, type: 'system' as const, text: line, timestamp: 0 }))
  );
  const [input, setInput] = useState('');
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [running, setRunning] = useState(false);
  const [granted, setGranted] = useState(false);
  const nextId = useRef(WELCOME.length);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isAdmin = userRole === 'admin' && userHandle.trim().toLowerCase() === 'flint';
  const canAccess = isAdmin;

  const addEntry = useCallback((type: HistoryEntry['type'], text: string) => {
    const id = nextId.current++;
    setHistory(prev => [...prev, { id, type, text, timestamp: Date.now() }]);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [history]);

  const executeCommand = async (cmd: string) => {
    if (!cmd.trim()) return;
    setRunning(true);
    addEntry('input', `$ ${cmd}`);

    try {
      const res = await fetch('/api/syn/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd.trim(), handle: userHandle }),
      });
      const data = await res.json();
      if (data.error) {
        addEntry('error', data.error);
      } else if (data.stdout) {
        data.stdout.split('\n').forEach((line: string) => addEntry('output', line));
      } else if (data.stderr) {
        data.stderr.split('\n').forEach((line: string) => addEntry('error', line));
      } else {
        addEntry('output', '// NO OUTPUT //');
      }
    } catch {
      addEntry('error', '// CONNECTION FAILED //');
    }
    setRunning(false);
    inputRef.current?.focus();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || running || !canAccess) return;
    setCmdHistory(prev => [...prev, input.trim()]);
    setHistoryIndex(-1);
    executeCommand(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (cmdHistory.length === 0) return;
      const idx = historyIndex === -1 ? cmdHistory.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(idx);
      setInput(cmdHistory[idx]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === -1) return;
      const idx = historyIndex + 1;
      if (idx >= cmdHistory.length) {
        setHistoryIndex(-1);
        setInput('');
      } else {
        setHistoryIndex(idx);
        setInput(cmdHistory[idx]);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Simple tab completion hint
      const cmd = input.trim().split(' ')[0];
      const commands = ['help', 'whoami', 'users', 'house', 'rooms', 'lockdown', 'suspend', 'unsuspend', 'autosweep', 'sweep', 'announce', 'log', 'clear'];
      const match = commands.find(c => c.startsWith(cmd));
      if (match) setInput(match + ' ');
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setHistory([]);
      nextId.current = 0;
    }
  };

  const clearTerminal = () => {
    setHistory([]);
    nextId.current = 0;
  };

  if (!canAccess) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-4" style={{ background: 'hsl(var(--background))' }}>
        <Lock size={48} style={{ color: 'hsl(var(--muted))' }} className="mb-4" />
        <h2 className="font-serif text-xl tracking-wider mb-2" style={{ color: 'hsl(var(--foreground))' }}>// ACCESS DENIED //</h2>
        <p className="font-mono text-xs text-center" style={{ color: 'hsl(var(--muted-foreground))' }}>Syn terminal is closed.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ background: '#0a0a0a' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'hsl(var(--primary) / 0.2)', background: 'hsl(var(--card))' }}>
        <div className="flex items-center gap-2.5">
          <Terminal size={16} style={{ color: 'hsl(var(--primary))' }} />
          <h2 className="font-mono text-xs uppercase tracking-widest" style={{ color: 'hsl(var(--primary))' }}>SYN TERMINAL</h2>
          {isAdmin && <ShieldCheck size={12} style={{ color: 'hsl(var(--destructive))' }} />}
        </div>
        <div className="flex items-center gap-2">
          {!granted ? (
            <button
              onClick={() => setGranted(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider rounded-sm transition-all hover:brightness-110"
              style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
            >
              <Play size={10} />
              Grant Access
            </button>
          ) : (
            <button
              onClick={clearTerminal}
              className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider rounded-sm transition-all hover:brightness-110"
              style={{ background: 'hsl(var(--destructive) / 0.15)', color: 'hsl(var(--destructive))', border: '1px solid hsl(var(--destructive) / 0.3)' }}
            >
              <Trash2 size={10} />
              Clear
            </button>
          )}
        </div>
      </div>

      {!granted && (
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <AlertTriangle size={40} style={{ color: 'hsl(var(--primary))' }} className="mb-3" />
          <p className="font-mono text-xs text-center mb-4" style={{ color: 'hsl(var(--muted-foreground))' }}>
            WARNING: Terminal access executes commands directly on the host device.<br />
            Only proceed if you understand the risks.
          </p>
          <button
            onClick={() => setGranted(true)}
            className="px-6 py-3 font-mono text-xs uppercase tracking-wider rounded-sm transition-all hover:brightness-110"
            style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
          >
            GRANT TERMINAL ACCESS
          </button>
        </div>
      )}

      {granted && (
        <>
          {/* Terminal output */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-relaxed space-y-0.5 scrollbar-thin" style={{ background: '#0a0a0a' }}>
            {history.map(entry => (
              <div
                key={entry.id}
                className={entry.type === 'input' ? 'mt-1' : ''}
                style={{
                  color:
                    entry.type === 'input' ? 'hsl(var(--primary))' :
                    entry.type === 'error' ? 'hsl(var(--destructive))' :
                    entry.type === 'system' ? 'hsl(var(--muted-foreground))' :
                    '#e0e0e0',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {entry.type === 'input' && <span className="mr-1.5" style={{ color: 'hsl(var(--primary))' }}>$</span>}
                {entry.text}
              </div>
            ))}
            {running && (
              <div className="flex items-center gap-1 mt-1" style={{ color: 'hsl(var(--primary))' }}>
                <span className="animate-pulse">_</span>
                <span className="font-mono text-[10px]">executing...</span>
              </div>
            )}
          </div>

          {/* Input bar */}
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 px-3 py-3 border-t"
            style={{ borderColor: 'hsl(var(--primary) / 0.2)', background: 'hsl(var(--card))' }}
          >
            <span className="font-mono text-xs flex-shrink-0" style={{ color: 'hsl(var(--primary))' }}>$</span>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter command..."
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
              className="flex-1 bg-transparent font-mono text-xs focus:outline-none"
              style={{ color: '#e0e0e0' }}
            />
            <button
              type="submit"
              disabled={running || !input.trim()}
              className="p-1.5 rounded-sm transition-all disabled:opacity-30"
              style={{ color: 'hsl(var(--primary))' }}
            >
              <Play size={14} />
            </button>
          </form>
        </>
      )}
    </div>
  );
}
