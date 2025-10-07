/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        "disco-pink": {
          DEFAULT: "#FF1493",
          light: "#FF69B4"
        }
      },
      fontFamily: {
        sans: ["'Inter'", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};
