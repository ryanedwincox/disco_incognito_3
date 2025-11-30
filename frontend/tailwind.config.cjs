/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}"
  ],
  safelist: [
    "pb-24"  // Ensure padding-bottom-24 is always compiled (used in SongRevealView)
  ],
  theme: {
    extend: {
      colors: {
        "disco-pink": {
          DEFAULT: "#D6006F",
          hover: "#E91E84"
        }
      },
      fontFamily: {
        sans: ["'Inter'", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};
