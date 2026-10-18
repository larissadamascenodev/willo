/**
 * The same palette the web app wears.
 *
 * On the web these are CSS variables that swap with the theme; here they are the
 * dark values written out, because the phone app is dark and the light theme was
 * never finished. The names are kept so a component carried over from ../src keeps
 * its classes working.
 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    /* Shared components, once they are carried over, bring their classes with them. */
    "../src/**/*.{ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        "willo-green": "#C8F36D",
        "willo-green-ink": "#C8F36D",
        "willo-amber": "#F9CE4E",
        "willo-black": "#0B0B0B",
        "willo-off-white": "#F8F7EE",
        "willo-caramel": "#B9804F",
        "willo-brown": "#6B4A2E",
        /* The two grounds: the room, and the room with the lights down. */
        "willo-bg": "#0D0E10",
        "willo-dim": "#08090A",
      },
    },
  },
  plugins: [],
};
