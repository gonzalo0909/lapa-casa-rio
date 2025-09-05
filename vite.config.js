import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src', // Tu index.html está en src/
  publicDir: '../assets', // Tus JS, CSS, etc. están en /assets
  build: {
    outDir: '../dist', // Carpeta de producción
    assetsDir: '', // No crear subcarpetas dentro de dist
    minify: 'terser',
    rollupOptions: {
      input: {
        main: 'src/index.html'
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
