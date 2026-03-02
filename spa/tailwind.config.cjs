/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
    '../templates/**/*.html',
    '../static/**/*.{js,html}'
  ],
  theme: {
    extend: {}
  },
  plugins: []
};
