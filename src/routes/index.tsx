import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import App from "@omerta/App";
import { installLocalApi } from "@omerta/local-api";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    installLocalApi();
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
