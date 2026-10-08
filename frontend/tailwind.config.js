/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fdf3f5",
          100: "#fbe3e8",
          200: "#f5c2cf",
          300: "#ec93aa",
          400: "#e05f80",
          500: "#c93760",
          600: "#a8264d",
          700: "#861d3e",
          800: "#651734",
          900: "#48122a",
        },
      },
    },
  },
  plugins: [],
};
