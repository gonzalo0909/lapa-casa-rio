// lapa-casa-hostel/frontend/postcss.config.js
//
// Sin este archivo, Next.js nunca le pasa el CSS a Tailwind/Autoprefixer
// -- @tailwind base/components/utilities en globals.css quedaban como
// at-rules no reconocidas y se descartaban silenciosamente. Ninguna
// clase de Tailwind se generaba en todo el proyecto (confirmado
// corriendo `next build` + `next start` y revisando el CSS servido:
// solo contenía los @font-face de next/font, cero utilidades).

module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
