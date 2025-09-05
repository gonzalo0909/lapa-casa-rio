import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',              // ✅ Usa src/ como raíz
  publicDir: '../assets',   // ✅ Sube un nivel para encontrar assets/
  build: {
    outDir: '../dist',      // ✅ Genera dist/ en frontend/dist
    assetsDir: '',
    minify: 'terser',
    rollupOptions: {
      input: {
        main: 'index.html'  // ✅ Relativo a src/
      },
      output: {
        entryFileNames: 'assets/js/[name].min.js',
        chunkFileNames: 'assets/js/[name].min.js',
        assetFileNames: 'assets/[ext]/[name].[ext]'
      }
    }
  },
  server: {
    port: 3000,
    open: true
  }
});
