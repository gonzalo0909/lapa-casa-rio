import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',              // ✅ Directorio actual (frontend/)
  publicDir: 'assets',    // ✅ Ajusta según dónde tengas los assets
  build: {
    outDir: 'dist',       // ✅ Generar en frontend/dist
    assetsDir: '',
    minify: 'terser',
    rollupOptions: {
      input: {
        main: 'index.html'  // ✅ Buscar en frontend/index.html
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
