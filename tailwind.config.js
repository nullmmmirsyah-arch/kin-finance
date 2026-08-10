/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#92400E",
        "primary-light": "#FDE68A",
        background: "#FFFBF5",
        surface: "#FEF3C7",
        "text-primary": "#1C1917",
        "text-secondary": "#6E675F",
        success: "#065F46",
        error: "#991B1B",
        border: "#E7E5E4",
        "primary-dark": "#F59E0B",
        "primary-light-dark": "#78350F",
        "background-dark": "#1C1917",
        "surface-dark": "#292524",
        "text-primary-dark": "#FAF9F7",
        "text-secondary-dark": "#A8A29E",
        "success-dark": "#34D399",
        "error-dark": "#F87171",
        "border-dark": "#44403C",
      },
    },
  },
  plugins: [],
};
