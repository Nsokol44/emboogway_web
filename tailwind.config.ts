import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Bebas Neue'", "sans-serif"],
        serif: ["'Playfair Display'", "serif"],
        sans: ["'DM Sans'", "sans-serif"],
      },
      colors: {
        gold: "#c9963a",
        "gold-light": "#f0c060",
        "gold-dim": "#7a5e20",
        ink: "#0f0b06",
        bark: "#2a1f0e",
        cream: "#f7f0e3",
        ember: "#c43e1c",
        forest: "#2d5a27",
      },
    },
  },
  plugins: [],
};
export default config;
