import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));
const BASE = "/Omerta/";

function rewritePublicPaths(): Plugin {
  return {
    name: "omerta-public-paths",
    transform(code, id) {
      if (!id.includes(`${path.sep}src${path.sep}omerta${path.sep}`)) return null;
      const next = code.replace(
        /(['"])\/(avatars\/[^'"]+|logo\.jpg)\1/g,
        (_match, quote: string, rest: string) => `${quote}${BASE}${rest}${quote}`,
      );
      return next === code ? null : next;
    },
  };
}

export default defineConfig({
  root: path.join(here, "pwa"),
  base: BASE,
  publicDir: path.join(here, "public"),
  resolve: {
    alias: {
      "@": path.join(here, "src"),
      "@omerta": path.join(here, "src/omerta"),
    },
  },
  plugins: [tailwindcss(), react(), rewritePublicPaths()],
  build: {
    outDir: path.join(here, "dist-pages"),
    emptyOutDir: true,
  },
});
