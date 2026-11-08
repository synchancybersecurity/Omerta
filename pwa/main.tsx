import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "@omerta/App";
import { installLocalApi } from "@omerta/local-api";
import "../src/styles.css";

function Root() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    installLocalApi();
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
    }
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <main className="flex h-dvh w-full items-center justify-center bg-[#0a0a0a]">
        <p className="font-serif text-4xl tracking-[0.35em] text-[#f0ebe6]">OMERTA</p>
      </main>
    );
  }

  return (
    <main className="h-dvh w-full overflow-hidden bg-[#0a0a0a] text-[#f0ebe6]">
      <App />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
