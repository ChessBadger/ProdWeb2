/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'primary': '#b91c1c', // red-700
        'primary-focus': '#991b1b', // red-800
      },
    },
  },
  plugins: [],
}
