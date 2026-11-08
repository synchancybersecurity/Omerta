import { useEffect, useRef } from 'react';

const COMMANDS = [
  'ssh -i ~/.ssh/id_rsa root@192.168.0.1',
  'openssl enc -aes-256-cbc -in secret.dat -out secret.enc',
  'nmap -sS -O -p 22,443,8080 target.host',
  'cat /etc/shadow | grep -v "^#"',
  'tcpdump -i eth0 -n -X port 443',
  'gpg --encrypt --recipient silencer_9 message.txt',
  'ping -c 4 -s 56 ghost.maker',
  'netstat -tuln | grep LISTEN',
  'curl -s -o /dev/null -w "%{http_code}" https://vault.omerta',
  'journalctl -u tor.service --since "1 hour ago"',
  'iptables -A INPUT -p tcp --dport 22 -j DROP',
  'strings /proc/self/environ | grep KEY',
  'dd if=/dev/zero of=/tmp/wipe bs=1M count=100',
  'nc -zv -w 2 10.0.0.1 1-65535',
  'ps aux | grep -i "omerta\|vault\|crypt"',
  'lastlog | awk \'{print $1, $5}\'',
  'scp -P 2222 evidence.zip silencer_9@drop:/incoming',
  'lsof -i :9050',
  'whoami && id && uname -a',
  'find /var/log -name "*.log" -mtime -1 -exec shred -u {} +',
  'cryptsetup luksOpen /dev/sdb1 vault',
  'tshark -i any -f "port 443" -w capture.pcap',
  'python3 -c "import socket; s=socket.socket(); s.connect((\'target\',22))"',
  'df -h | grep -E "vault|crypt|secure"',
  'systemctl status omerta-daemon.service',
  'rsync -avz --delete -e "ssh -p 2222" ./ops/ silencer_9@host:/backup',
  'htop -d 5',
  'mtr --report --report-cycles 10 target.host',
  'sha256sum /var/secure/vault.key',
  'base64 -d < payload.b64 > payload.bin',
  'chmod 600 ~/.gnupg/secring.gpg',
  'chown root:root /etc/omerta/config.yml',
  'route -n | grep UG',
  'arp -a | grep -v incomplete',
  'iwconfig 2>/dev/null | grep -v "no wireless"',
  'dmesg | tail -n 20 | grep -i error',
  'lsmod | grep crypt',
  'modprobe aes_x86_64',
  'sysctl -w net.ipv4.tcp_syncookies=1',
  'ulimit -n 65535',
  'echo $SHELL $TERM $DISPLAY',
  'env | grep -i "proxy\|tor\|vpn"',
  'history | tail -n 5',
  'alias | grep ssh',
  'export OMERTA_KEY=$(cat /dev/urandom | tr -dc A-Za-z0-9 | head -c 32)',
  'stty -echo; read -p "PASS: " PASS; stty echo',
  'clear && echo "// SYSTEM READY //" && date',
  'sleep 2 && echo "// CONNECTION ESTABLISHED //"',
  'wall "ALL CHANNELS ACTIVE. STANDBY."',
  'logger -t omerta "drop point confirmed"',
  'kill -9 $(pgrep -f listener)',
  'nohup ./relay.sh > /dev/null 2>&1 &',
  'disown -a',
  'screen -dmS session_9',
  'tmux new -d -s vault',
  'watch -n 5 "ss -tuln | wc -l"',
  'at now + 1 hour <<< "shred -u /tmp/burn/*"',
  'crontab -l | grep omerta',
  'uptime',
  'free -m',
  'vmstat 1 3',
  'iostat -x 1 3',
  'mpstat -P ALL 1 2',
  'sar -n DEV 1 3',
  'pidstat 1 3',
  'strace -p $(pgrep omerta) -e trace=network',
  'ltrace -e getenv ./vault',
  'objdump -d ./omerta | grep -A5 main',
  'readelf -h ./omerta',
  'ldd ./omerta',
  'nm ./omerta | grep -i crypt',
  'strings ./omerta | grep -i "password\|secret\|key"',
  'xxd -l 256 ./omerta',
  'hexdump -C /dev/urandom | head -n 5',
  'od -An -tx1 -N 32 /dev/urandom',
  'rand -base64 48',
  'uuidgen',
  'mkfifo /tmp/omerta_pipe',
  'exec 3<>/tmp/omerta_pipe',
  'echo "dead drop coordinates" > /tmp/omerta_pipe',
];

interface TerminalLine {
  text: string;
  x: number;
  y: number;
  speed: number;
  opacity: number;
  size: number;
  isCommand: boolean;
}

export default function MatrixBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const c = ctx;

    let w = window.innerWidth;
    let h = window.innerHeight;
    canvas.width = w;
    canvas.height = h;

    const lines: TerminalLine[] = [];
    let spawnTimer = 0;

    function spawnLine() {
      const cmd = COMMANDS[Math.floor(Math.random() * COMMANDS.length)];
      lines.push({
        text: `$ ${cmd}`,
        x: Math.random() * (w * 0.6),
        y: -20,
        speed: 0.3 + Math.random() * 0.5,
        opacity: 0.3 + Math.random() * 0.7,
        size: 11 + Math.floor(Math.random() * 4),
        isCommand: true,
      });

      // Sometimes spawn output lines after a command
      if (Math.random() < 0.4) {
        const outputs = [
          '> OK',
          '> 200 OK',
          '> Connection established',
          '> Packet encrypted',
          '> Verified',
          '> [OK]',
          '> Done.',
          '> Success',
          '> 4 packets transmitted, 4 received',
          '> Handshake complete',
          '> Channel secured',
          '> Token valid',
          '> ACK',
          '> EOF',
          '> Process completed',
          '> Listening...',
          '> Route clear',
        ];
        lines.push({
          text: outputs[Math.floor(Math.random() * outputs.length)],
          x: Math.random() * (w * 0.5) + 20,
          y: -20,
          speed: 0.3 + Math.random() * 0.5,
          opacity: 0.15 + Math.random() * 0.35,
          size: 10 + Math.floor(Math.random() * 3),
          isCommand: false,
        });
      }
    }

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
    };
    window.addEventListener('resize', resize);

    let anim = 0;
    function draw() {
      const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
      // Theme-aware background
      c.fillStyle = isDark ? '#0A0A0A' : '#F0F0F0';
      c.fillRect(0, 0, w, h);

      // Spawn new lines
      spawnTimer++;
      if (spawnTimer > 30 + Math.random() * 60) {
        spawnTimer = 0;
        spawnLine();
      }

      // Draw each line
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        line.y += line.speed;

        if (line.y > h + 20) {
          lines.splice(i, 1);
          continue;
        }

        c.font = `${line.isCommand ? '500' : '400'} ${line.size}px 'JetBrains Mono', monospace`;

        // LED glow effect
        c.shadowColor = isDark ? '#B91C1C' : '#991B1B';
        c.shadowBlur = line.isCommand ? 6 : 3;

        // Main text
        c.fillStyle = isDark ? `rgba(185, 28, 28, ${line.opacity})` : `rgba(160, 20, 20, ${line.opacity})`;
        c.fillText(line.text, line.x, line.y);

        // Reset shadow
        c.shadowBlur = 0;

        // Occasional brighter pixel-dots for LED matrix feel
        if (line.isCommand && Math.random() < 0.02) {
          for (let px = 0; px < line.text.length; px++) {
            if (Math.random() < 0.1) {
              const charX = line.x + px * line.size * 0.6;
              const charY = line.y - line.size * 0.3;
              c.fillStyle = isDark ? `rgba(220, 50, 50, ${line.opacity * 1.5})` : `rgba(180, 30, 30, ${line.opacity * 1.5})`;
              c.fillRect(charX, charY, 2, 2);
            }
          }
        }
      }

      // Subtle scanline overlay
      c.fillStyle = isDark ? 'rgba(0, 0, 0, 0.03)' : 'rgba(0, 0, 0, 0.04)';
      for (let y = 0; y < h; y += 4) {
        c.fillRect(0, y, w, 1);
      }

      anim = requestAnimationFrame(draw);
    }

    anim = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(anim);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
      }}
    />
  );
}
