/** @type {import('tailwindcss').Config} */
// Color values follow the organization's canonical brand tokens.
//
// `tint.*` keeps the digital tint ramps verbatim with their canonical
// numbering. Grey 100-900 follows the grayscale ramp.
//
// `brand.*` and `slate.*` are semantic slots used by existing components.
// They hold canonical brand values, but the slot numbering is shifted so
// the strongest accent lands on the slots components already use for
// primary actions. This is an implementation guardrail, not a brand rule.
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Canonical digital tints.
        tint: {
          cyan: {
            50: "#E6FFFF",
            100: "#BFFFFF",
            200: "#80FFFF",
            300: "#40FFFF",
            400: "#00FFFF",
            500: "#00EAEA",
            600: "#00D0D0",
            700: "#00AAAA",
            800: "#007A7A",
          },
          blue: {
            50: "#E6E6FF",
            100: "#BFBFFF",
            200: "#8080FF",
            300: "#4040FF",
            400: "#0018CE",
            500: "#0710A8",
            600: "#170080",
            700: "#26005C",
            800: "#180038",
          },
          violet: {
            50: "#F0E6F9",
            100: "#D8BFEF",
            200: "#B280DF",
            300: "#8B40CE",
            400: "#6400BE",
            500: "#50009F",
            600: "#3B007D",
            700: "#29005A",
            800: "#190038",
          },
          magenta: {
            50: "#FFE6F5",
            100: "#FFBFE6",
            200: "#FF80CD",
            300: "#FF40B4",
            400: "#FF009B",
            500: "#D90083",
            600: "#B0006B",
            700: "#82004E",
            800: "#4A002D",
          },
          red: {
            50: "#FFE6E6",
            100: "#FFBFBF",
            200: "#FF8080",
            300: "#FF4040",
            400: "#FF0000",
            500: "#D90000",
            600: "#B00000",
            700: "#800000",
            800: "#4D0000",
          },
        },
        // Semantic accent slots over brand blue with the cyan signature
        // for dark-mode accents: #00FFFF on the dark canvas keeps 14.7:1
        // contrast while matching the brand gradient start.
        brand: {
          50: "#E6E6FF",
          100: "#BFBFFF",
          200: "#8080FF",
          300: "#4040FF",
          400: "#00FFFF",
          500: "#0018CE",
          600: "#0710A8",
          700: "#170080",
          800: "#26005C",
          900: "#180038",
          950: "#180038",
        },
        // Neutral slots over the brand greys and black tints.
        // Secondary text lands on #595959 for 7:1 on white.
        slate: {
          50: "#FAFAFA",
          100: "#F2F2F2",
          200: "#D9D9D9",
          300: "#BFBFBF",
          400: "#808080",
          500: "#595959",
          600: "#404040",
          700: "#333333",
          800: "#1A1A1A",
          900: "#000000",
          950: "#000000",
        },
      },
    },
  },
  plugins: [],
};
