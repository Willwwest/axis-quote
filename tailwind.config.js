/** @type {import('tailwindcss').Config} */

// Every color is a semantic token from src/styles/tokens.css, so a theme swap is a variable change.
const token = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: token("bg"),
        sunken: token("sunken"),
        surface: token("surface"),
        raised: token("raised"),
        fg: token("fg"),
        "on-accent": token("on-accent"),
        accent: {
          DEFAULT: token("accent"),
          bright: token("accent-bright"),
          deep: token("accent-deep"),
          fg: token("accent-fg"),
        },
        success: token("success"),
        warn: token("warn"),
        info: token("info"),
        danger: token("danger"),
        scrim: token("scrim"),
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-lg)",
        "2xl": "var(--radius-xl)",
      },
      keyframes: {
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
      },
      animation: { marquee: "marquee 60s linear infinite" },
      boxShadow: {
        glow: "var(--shadow-glow)",
        pop: "var(--shadow-pop)",
      },
    },
  },
  plugins: [],
};
