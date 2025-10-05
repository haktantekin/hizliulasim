/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'soft-blue': 'var(--soft-blue)',
        'dark-blue': 'var(--dark-blue)',
        'light-blue': 'var(--light-blue)',
        'yellow': 'var(--yellow)',
        'green': 'var(--green)',
        'gray': 'var(--gray)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};