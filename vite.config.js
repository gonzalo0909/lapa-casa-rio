import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src', // Todo empieza aquí
  build: {
    outDir: '../dist', // La salida va a la carpeta de arriba
    assetsDir: 'assets', // Los recursos se guardan en dist/assets/
    minify: 'terser',
    rollupOptions: {
      output: {
        entryFileNames: 'js/[name].min.js',
        chunkFileNames: 'js/[name].min.js',
        assetFileNames: '[ext]/[name].[ext]'
      }
    }
  },
  server: {
    port: 3000,
    open: true
  }
});
