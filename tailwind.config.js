/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["app/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#92400E",
        "primary-light": "#FDE68A",
        background: "#FFFBF5",
        surface: "#FEF3C7",
        "text-primary": "#1C1917",
        "text-secondary": "#78716C",
        success: "#065F46",
        error: "#991B1B",
        border: "#E7E5E4",
      },
    },
  },
  plugins: [],
};
