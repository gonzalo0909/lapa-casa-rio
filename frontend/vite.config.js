import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  publicDir: '../assets',
  build: {
    outDir: '../dist',
    assetsDir: '',
    minify: 'terser',
    rollupOptions: {
      input: {
        main: 'index.html'
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
