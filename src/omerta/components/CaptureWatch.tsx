import { useEffect } from "react";
import { useApp } from "@omerta/store/AppContext";
import { useApi } from "@omerta/store/ApiContext";

export default function CaptureWatch() {
  const { isAuthenticated, userHandle } = useApp();
  const { reportCapture } = useApi();

  useEffect(() => {
    if (!isAuthenticated || !userHandle) return;
    let hiddenAt = 0;
    let baseInset = -1;
    let lastNote = 0;
    const note = (kind: "screenshot" | "recording") => {
      const now = Date.now();
      if (now - lastNote < 2500) return;
      lastNote = now;
      void reportCapture(userHandle, kind);
      window.dispatchEvent(new Event("omerta-blank"));
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "PrintScreen" || event.code === "PrintScreen") note("screenshot");
    };
    const onPrint = () => note("screenshot");
    const onVis = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 40 && Date.now() - hiddenAt < 700) note("screenshot");
    };
    const timer = window.setInterval(() => {
      const probe = document.getElementById("capture-inset");
      const next = probe ? probe.offsetHeight : 0;
      if (baseInset < 0) {
        baseInset = next;
        return;
      }
      if (next - baseInset >= 8) {
        note("recording");
        baseInset = next;
      } else if (next + 8 < baseInset) {
        baseInset = next;
      }
    }, 1000);
    document.addEventListener("keyup", onKey);
    window.addEventListener("beforeprint", onPrint);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("keyup", onKey);
      window.removeEventListener("beforeprint", onPrint);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [isAuthenticated, userHandle, reportCapture]);

  return <div id="capture-inset" aria-hidden="true" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden", paddingTop: "env(safe-area-inset-top)", pointerEvents: "none" }} />;
}
