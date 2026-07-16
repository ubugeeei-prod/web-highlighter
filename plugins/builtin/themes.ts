import { defineTheme } from "../../extension/src/plugin-api.ts";

export const builtinThemes = Object.freeze([
  defineTheme({
    id: "adaptive",
    name: "Adaptive",
    dark: false,
    colors: {
      foreground: "#24292f",
      background: "transparent",
      selection: "#0969da33",
      keyword: "#cf222e",
      type: "#8250df",
      constant: "#0550ae",
      string: "#0a3069",
      number: "#0550ae",
      comment: "#6e7781",
      operator: "#cf222e",
      function: "#8250df",
      variable: "#24292f",
      property: "#953800",
      punctuation: "#57606a"
    },
  }),
  defineTheme({
    id: "midnight",
    name: "Midnight",
    dark: true,
    colors: {
      foreground: "#e6edf3",
      background: "transparent",
      selection: "#58a6ff33",
      keyword: "#ff7b72",
      type: "#d2a8ff",
      constant: "#79c0ff",
      string: "#a5d6ff",
      number: "#79c0ff",
      comment: "#8b949e",
      operator: "#ff7b72",
      function: "#d2a8ff",
      variable: "#e6edf3",
      property: "#ffa657",
      punctuation: "#8b949e"
    },
  }),
]);
