/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        axis: {
          red: "#da281b",
          bright: "#ff2a2a",
          deep: "#b30000",
          black: "#0b0b0c",
          ink: "#121214",
          panel: "#17171a",
          line: "#2a2a2e",
          mute: "#8a8a93",
        },
      },
      fontFamily: {
        display: ["Outfit", "system-ui", "sans-serif"],
        body: ["DM Sans", "system-ui", "sans-serif"],
      },
      keyframes: {
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
      },
      animation: { marquee: "marquee 60s linear infinite" },
      boxShadow: {
        glow: "0 0 0 1px rgba(218,40,27,.5), 0 10px 40px -10px rgba(218,40,27,.6)",
      },
    },
  },
  plugins: [],
};
