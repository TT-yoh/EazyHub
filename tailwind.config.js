/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ⭐ DECLARE YOUR CUSTOM SEMANTIC BRAND VARIATIONS HERE
        brand: {
          light: '#eff6ff',  // bg-brand-light (Equivalent to blue-50)
          DEFAULT: '#2563eb',// bg-brand (Your main blue-600)
          dark: '#1d4ed8',   // bg-brand-dark (Your hover state)
        },
        surface: {
          canvas: '#f8fafc', // bg-surface-canvas
          card: '#ffffff',   // bg-surface-card
        },
        status: {
          success: '#059669', // text-status-success
          pending: '#d97706', // text-status-pending
          danger: '#dc2626',  // text-status-danger
        }
      },
    },
  },
  plugins: [],
}