import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    // For microphone access in development, ensure you're using localhost
    // If you need HTTPS, uncomment the lines below and provide certificates
    // https: {
    //   key: 'path/to/key.pem',
    //   cert: 'path/to/cert.pem'
    // }
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
