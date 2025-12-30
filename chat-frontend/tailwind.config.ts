import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          500: "#10B981",
          600: "#059669",
        },
        bubble: {
          meBg: "#DCFCE7",
          meText: "#166534",
          otherBg: "#F3F4F6",
          otherText: "#111827",
        },
      },
    },
  },
  plugins: [],
};

export default config;