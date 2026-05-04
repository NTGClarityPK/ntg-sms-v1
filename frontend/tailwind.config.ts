import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        'brand-green': '#4A7C59',
        'brand-green-light': '#6FA382',
        'brand-green-lighter': '#A8C9B3',
        'brand-green-pale': '#E0F0E5',
        burgundy: '#7C4A52',
        'burgundy-light': '#A67C82',
        'burgundy-lighter': '#C9A8AD',
        'burgundy-pale': '#F0E5E7',
        'brand-glow-light': '#A8C9B3',
      },
      fontFamily: {
        sans: ['var(--font-saira)', 'system-ui', 'sans-serif'],
        heading: ['var(--font-audiowide)', 'cursive', 'sans-serif'],
      },
      borderRadius: {
        alma: '2.5rem',
        'alma-lg': '3rem',
        'alma-xl': '3.5rem',
      },
      keyframes: {
        capBounce: {
          '0%, 100%': { transform: 'translateY(0) rotate(-5deg)' },
          '50%': { transform: 'translateY(-14px) rotate(5deg)' },
        },
        bookBounce: {
          '0%, 100%': { transform: 'translateY(0) rotate(3deg)' },
          '50%': { transform: 'translateY(-16px) rotate(-3deg)' },
        },
        pencilBounce: {
          '0%, 100%': { transform: 'translateY(0) rotate(-4deg)' },
          '50%': { transform: 'translateY(-15px) rotate(4deg)' },
        },
      },
      animation: {
        'cap-bounce': 'capBounce 3s ease-in-out infinite',
        'book-bounce': 'bookBounce 4s ease-in-out infinite 0.5s',
        'pencil-bounce': 'pencilBounce 3.5s ease-in-out infinite 1s',
      },
    },
  },
  plugins: [],
};

export default config;
