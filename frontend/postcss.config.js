// lapa-casa-hostel-frontend/postcss.config.js

module.exports = {
  plugins: {
    'tailwindcss': {},
    'autoprefixer': {},
    'cssnano': process.env.NODE_ENV === 'production' ? {
      preset: ['default', {
        discardComments: { removeAll: true },
        normalizeWhitespace: true,
        reduceIdents: false,
        zindex: false,
      }]
    } : false,
  },
}
