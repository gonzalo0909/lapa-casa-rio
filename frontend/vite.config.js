import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: 'src', // Asume que tu index.html está en frontend/src/
  publicDir: '../public', // Archivos estáticos (favicon, etc.)
  build: {
    outDir: '../dist', // La salida va fuera de src/
    assetsDir: 'assets',
    minify: 'terser',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/index.html'),
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
