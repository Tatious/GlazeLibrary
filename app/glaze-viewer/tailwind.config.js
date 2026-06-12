/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "media", // Enable dark mode based on system preference
  // Gate `hover:` utilities behind @media (hover: hover) so they don't
  // stick on touch devices — otherwise the first tap on a card just
  // activates the hover state and the click is dropped.
  future: { hoverOnlyWhenSupported: true },
  theme: {
    extend: {
      // Breakpoint system, hinged on viewport HEIGHT 480px:
      //   `xsl`               = (max-height: 480px) — mobile landscape
      //   `xs/sm/md/lg/xl/2xl` = standard width tiers AND (min-height: 481px)
      //
      // Why height (not orientation)? It precisely identifies a phone in
      // landscape — no tablet or desktop has a viewport shorter than 480px.
      // The `(min-height: 481px)` clause on the width tiers makes them
      // mutually exclusive with `xsl`: at any viewport, either `xsl`
      // matches or the width tiers do, never both. That eliminates the
      // cascade fight where `md:grid-cols-3` was overriding our intended
      // landscape-phone 4-col layout.
      //
      // The base (no-prefix) layer is the unconditional default that
      // applies everywhere; tier prefixes are progressive enhancements
      // (mobile-first within the portrait axis) plus the `xsl` override
      // for landscape phones.
      screens: {
        xsl: { raw: "(max-height: 480px)" },
        xs: { raw: "(min-width: 480px) and (min-height: 481px)" },
        sm: { raw: "(min-width: 640px) and (min-height: 481px)" },
        md: { raw: "(min-width: 768px) and (min-height: 481px)" },
        lg: { raw: "(min-width: 1024px) and (min-height: 481px)" },
        xl: { raw: "(min-width: 1280px) and (min-height: 481px)" },
        "2xl": { raw: "(min-width: 1536px) and (min-height: 481px)" },
      },
      colors: {
        // Earthy pottery-inspired palette
        clay: {
          50: "#fefdfb",
          100: "#fdf8f0",
          200: "#f9eddc",
          300: "#f2dcc1",
          400: "#e8c69f",
          500: "#d9a97a",
          600: "#c48b59",
          700: "#a3714a",
          800: "#855d40",
          900: "#6d4d37",
          950: "#3a281d",
        },
        // Earthy sage - muted olive with visible green
        sage: {
          50: "#f5f6f2",
          100: "#e4e8dc",
          200: "#ced5c0",
          300: "#adb898",
          400: "#8a9a6f",
          500: "#6d7d52",
          600: "#556340",
          700: "#434e34",
          800: "#373f2c",
          900: "#2d3425",
          950: "#181c14",
        },
        // Earthy moss - deep forest green with warmth
        moss: {
          50: "#f3f5f1",
          100: "#e3e8dd",
          200: "#c9d3be",
          300: "#a4b494",
          400: "#6b9b4a", // Brighter for focus rings
          500: "#607548",
          600: "#4b5c39",
          700: "#3c492f",
          800: "#323c28",
          900: "#293122",
          950: "#151a12",
        },
        terracotta: {
          50: "#fff8f5",
          100: "#ffede6",
          200: "#ffdacc",
          300: "#ffbda3",
          400: "#ff9670",
          500: "#f96d42",
          600: "#e6502a",
          700: "#c13e1e",
          800: "#9f351d",
          900: "#83301d",
          950: "#47160c",
        },
        // Warm accent - butter yellow
        butter: {
          50: "#fefce8",
          100: "#fef9c3",
          200: "#fef08a",
          300: "#fde047",
          400: "#facc15",
          500: "#eab308",
          600: "#ca8a04",
          700: "#a16207",
          800: "#854d0e",
          900: "#713f12",
          950: "#422006",
        },
        // Soft pink accent for "cute" touches
        blush: {
          50: "#fef1f7",
          100: "#fee5f0",
          200: "#ffcce3",
          300: "#ffa1cb",
          400: "#ff69a8",
          500: "#fb3c87",
          600: "#eb1a64",
          700: "#cc0c4b",
          800: "#a80e3f",
          900: "#8c1038",
          950: "#56021b",
        },
        // Earthy dark mode colors
        earth: {
          // Dark backgrounds - warm browns and deep greens
          900: "#1a1612", // Darkest - almost black with brown warmth
          850: "#221e19", // Very dark brown
          800: "#2a2520", // Dark warm brown (main dark bg)
          750: "#332d26", // Slightly lighter brown
          700: "#3d362d", // Medium dark brown (cards)
          600: "#4a4238", // Lighter brown (borders, hover)
          500: "#5c5246", // Muted brown (secondary text)
          400: "#7a6e5f", // Light brown (subtle text)
        },
      },
      keyframes: {
        "overlay-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "dialog-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "sheet-in": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
      },
      animation: {
        "overlay-in": "overlay-in 0.15s ease-out",
        "dialog-in": "dialog-in 0.18s cubic-bezier(0.34, 1.3, 0.64, 1)",
        "sheet-in": "sheet-in 0.22s cubic-bezier(0.32, 0.72, 0, 1)",
      },
    },
  },
  plugins: [],
};
