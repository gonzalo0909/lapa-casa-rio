// frontend/.lintstagedrc.js
// Solo formatea automáticamente los archivos en stage. El chequeo de tipos
// (bloqueante) corre aparte sobre el proyecto entero en .husky/pre-commit --
// `next lint --file` no reproduce fielmente las reglas de `next lint`
// (npm run lint) cuando se lo restringe a archivos puntuales, así que no se
// usa acá para evitar bloquear commits por falsos positivos.
module.exports = {
  '*.{ts,tsx,js,jsx,json,css,md}': 'prettier --write',
};
