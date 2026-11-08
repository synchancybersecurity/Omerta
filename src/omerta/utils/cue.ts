export function readPolicy() {
  try { return JSON.parse(localStorage.getItem("omerta_policy") || "{}") as Record<string, boolean>; } catch { return {}; }
}

export function cue(title: string) {
  const policy = readPolicy();
  if (policy.sound) {
    try {
      const ctx = new AudioContext();
      const tone = ctx.createOscillator();
      const gain = ctx.createGain();
      tone.frequency.value = 440;
      gain.gain.value = 0.04;
      tone.connect(gain);
      gain.connect(ctx.destination);
      tone.start();
      tone.stop(ctx.currentTime + 0.09);
      window.setTimeout(() => void ctx.close(), 300);
    } catch { /* this browser has no sound */ }
  }
  if (policy.notifications && document.hidden && "Notification" in window && Notification.permission === "granted") {
    try { new Notification("Omertà", { body: title, icon: "/logo.jpg" }); } catch { /* permission can change */ }
  }
}
