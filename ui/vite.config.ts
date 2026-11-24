import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// web-ifc loads its WASM by file name from a folder. Ship it under a fixed path,
// so the IFC viewer runs offline without a CDN.
const require = createRequire(import.meta.url);
const webIfcWasm = () => readFileSync(require.resolve("web-ifc/web-ifc.wasm"));
function webIfcAsset(): Plugin {
  return {
    name: "web-ifc-wasm",
    configureServer(server) {
      server.middlewares.use("/web-ifc/web-ifc.wasm", (_request, response) => {
        response.setHeader("Content-Type", "application/wasm");
        response.end(webIfcWasm());
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "web-ifc/web-ifc.wasm", source: webIfcWasm() });
    },
  };
}

// During development the Python server runs on port 8765 (python -m nova_legend --server)
export default defineConfig({
  plugins: [react(), tailwindcss(), webIfcAsset()],
  server: { proxy: { "/api": "http://127.0.0.1:8765" } },
  build: { outDir: "dist", emptyOutDir: true },
});
