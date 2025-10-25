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
        // Brand colors - extend, don't override
        'brand-soft-blue': 'var(--soft-blue)',
        'brand-dark-blue': 'var(--dark-blue)', 
        'brand-light-blue': 'var(--light-blue)',
        'brand-yellow': 'var(--yellow)',
        'brand-green': 'var(--green)',
        'brand-orange': 'var(--orange)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};