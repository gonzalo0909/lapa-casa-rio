import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: 'src', // Indica que el punto de entrada es src/
  publicDir: '../public', // Archivos estáticos como favicon
  build: {
    outDir: '../dist', // Carpeta de salida
    assetsDir: 'assets', // Donde se guardan los .js, .css
    minify: 'terser', // Minifica con Terser (mejor compresión)
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/index.html'),
      },
    },
  },
  server: {
    port: 3000,
    open: true, // Abre el navegador al iniciar
  },
});
