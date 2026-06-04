import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#150d24",
        "surface-card": "rgba(46, 16, 72, 0.7)",
        border: "rgba(168, 85, 247, 0.2)",
        brand: {
          DEFAULT: "#9333ea",
          light: "#c084fc",
          dark: "#6b21a8",
        },
      },
      textColor: {
        primary: "#f0f6ff",
        secondary: "#94a3b8",
      },
      keyframes: {
        bounceDot: {
          "0%, 60%, 100%": { transform: "translateY(0)", opacity: "0.4" },
          "30%": { transform: "translateY(-8px)", opacity: "1" },
        },
        pulseMic: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(239, 68, 68, 0.3)" },
          "50%": { boxShadow: "0 0 0 8px rgba(239, 68, 68, 0)" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        flip: {
          to: { transform: "rotateY(180deg)" },
        },
      },
      animation: {
        "bounce-dot": "bounceDot 1.2s infinite",
        "pulse-mic": "pulseMic 2s infinite",
        "slide-up": "slideUp 0.3s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
