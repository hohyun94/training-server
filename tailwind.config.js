/** @type {import('tailwindcss').Config} */
export default {
  content: ['./web/index.html', './web/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Pretendard',
          'Pretendard Variable',
          'system-ui',
          '-apple-system',
          'Apple SD Gothic Neo',
          'Malgun Gothic',
          'sans-serif'
        ],
        display: ['Pretendard Variable', 'Pretendard', 'system-ui', 'sans-serif']
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' }
        }
      },
      animation: {
        'fade-up': 'fade-up .35s ease-out both',
        'pulse-soft': 'pulseSoft 1.6s ease-in-out infinite'
      }
    }
  },
  plugins: []
};
