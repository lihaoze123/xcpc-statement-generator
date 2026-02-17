/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1677FF',
        'base-100': '#FFFFFF',
        'base-200': '#F9FAFB',
        'base-300': '#F5F5F5',
        'base-content': '#1A1A1A',
        'secondary-content': '#8C8C8C',
        'base-border': '#E5E7EB',
      }
    },
  },
  plugins: [require('daisyui'), require('@tailwindcss/typography')],
  daisyui: {
    themes: [
      {
        light: {
          "primary": "#1677FF",
          "primary-content": "#ffffff",
          "secondary": "#8C8C8C",
          "secondary-content": "#ffffff",
          "accent": "#1677FF",
          "accent-content": "#ffffff",
          "neutral": "#1A1A1A",
          "neutral-content": "#ffffff",
          "base-100": "#FFFFFF",
          "base-200": "#F9FAFB",
          "base-300": "#F5F5F5",
          "base-content": "#1A1A1A",
          "info": "#1677FF",
          "info-content": "#ffffff",
          "success": "#52c41a",
          "success-content": "#ffffff",
          "warning": "#faad14",
          "warning-content": "#ffffff",
          "error": "#ff4d4f",
          "error-content": "#ffffff",
        },
      },
    ],
  },
}
