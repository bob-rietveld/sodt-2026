import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#fd5924",        // techleap-orange
        secondary: "#512986",      // indigo-purple
        background: "#f6f6f3",     // cream
        foreground: "#242424",     // dark-grey
        success: "#2a80e7",        // azure
        info: "#081dab",           // cobalt-blue
        warning: "#9441e9",        // electric-violet
        danger: "#23154e",         // deep-purple
      },
      fontFamily: {
        sans: ["Fira Sans", "sans-serif"],
        mono: ["Fira Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
