module.exports = {presets: [require("nativewind/preset")],
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#0B0F19",
        card: "#151C2C",
        line: "#2A354D",
        indigo: "#6366F1",
        cyan: "#06B6D4",
        won: "#10B981",
        alert: "#EF4444",
      },
    },
  },
  plugins: [],
};
