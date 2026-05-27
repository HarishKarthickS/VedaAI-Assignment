import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      boxShadow: {
        surface: "0 18px 38px rgba(22, 22, 22, 0.08)",
        sidebar: "0 24px 36px rgba(22, 22, 22, 0.15)",
      },
    },
  },
  plugins: [],
} satisfies Config;
