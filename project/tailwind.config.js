/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#16212B',
        asphalt: { DEFAULT: '#1C2732', 700: '#26343F', 600: '#33444F', 500: '#4B5C68' },
        concrete: { DEFAULT: '#EDEFF0', 100: '#F6F7F8', 200: '#DDE1E4', 300: '#C7CED3', 400: '#9AA5AD' },
        lane: { DEFAULT: '#F5B700', 600: '#D9A000', 700: '#8A6500', 100: '#FFF3CC' },
        signal: {
          red: '#C8392F',
          redbg: '#FBE9E7',
          amber: '#B45F00',
          amberbg: '#FDEFD9',
          green: '#23784A',
          greenbg: '#E2F3EA',
          blue: '#2563A8',
          bluebg: '#E3EDF8',
          gray: '#5B6771',
          graybg: '#ECEFF1',
        },
      },
      fontFamily: {
        display: ['"Barlow Condensed"', '"Arial Narrow"', 'system-ui', 'sans-serif'],
        sans: ['"Public Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 1px 0 rgba(22,33,43,0.06), 0 0 0 1px rgba(22,33,43,0.08)',
      },
    },
  },
  plugins: [],
};
