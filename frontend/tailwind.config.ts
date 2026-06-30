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
        brand: {
          50: "#f0f4ff",
          100: "#dbe4ff",
          200: "#bac8ff",
          300: "#91a7ff",
          400: "#748ffc",
          500: "#5c7cfa",
          600: "#4c6ef5",
          700: "#4263eb",
          800: "#3b5bdb",
          900: "#364fc7",
        },
        surface: {
          0: "#f8f9fa",
          1: "#f1f3f5",
          2: "#e9ecef",
          3: "#dee2e6",
          4: "#ced4da",
        },
        success: { 500: "#40c057", 600: "#2f9e44" },
        warning: { 500: "#fab005", 600: "#f59f00" },
        danger: { 500: "#fa5252", 600: "#e03131" },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      borderRadius: {
        xl2: "1rem",
        xl3: "1.25rem",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        cardHover: "0 8px 25px rgba(0,0,0,0.1)",
        glow: "0 0 20px rgba(92,124,250,0.3)",
        innerLight: "inset 0 1px 0 rgba(255,255,255,0.1)",
      },
      backgroundImage: {
        gradientBrand: "linear-gradient(135deg, #4263eb 0%, #748ffc 100%)",
        gradientDark: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
        gradientHero: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        gradientAccent: "linear-gradient(135deg, #5c7cfa 0%, #40c057 100%)",
        gradientWarm: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
        gradientCool: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
        gradientMesh: "radial-gradient(at 40% 20%, rgba(92,124,250,0.15) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(64,192,87,0.1) 0px, transparent 50%), radial-gradient(at 0% 50%, rgba(250,80,80,0.08) 0px, transparent 50%)",
      },
      animation: {
        fadeIn: "fadeIn 0.5s ease-out",
        slideUp: "slideUp 0.4s ease-out",
        slideDown: "slideDown 0.3s ease-out",
        pulseSoft: "pulseSoft 3s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
        float: "float 6s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          "0%": { opacity: "0", transform: "translateY(-10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
