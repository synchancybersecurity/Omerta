import { useEffect, useState } from "react";

export default function AntiScreenshotOverlay() {
  const [cover, setCover] = useState(false);
  const [away, setAway] = useState(false);

  useEffect(() => {
    const onBlank = () => setCover(true);
    const onVis = () => setAway(document.visibilityState === "hidden");
    window.addEventListener("omerta-blank", onBlank);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("omerta-blank", onBlank);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  if (!cover && !away) return null;
  return (
    <button
      type="button"
      aria-label="Screen is black"
      className="fixed inset-0 z-[200]"
      style={{ background: "#000" }}
      onClick={() => { if (!away) setCover(false); }}
    >
      {cover && !away && (
        <span className="font-mono text-[10px] tracking-wider" style={{ color: "#3a3a3a" }}>Tap to return</span>
      )}
    </button>
  );
}
