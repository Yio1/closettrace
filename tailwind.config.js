/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        text: 'var(--text)',
        muted: 'var(--muted)',
        line: 'var(--line)',
        accent: 'var(--accent)',
        'accent-text': 'var(--accent-text)',
        'on-accent': 'var(--on-accent)',
        danger: 'var(--danger)',
        'danger-fill': 'var(--danger-fill)',
        'on-danger': 'var(--on-danger)',
        'danger-text': 'var(--danger-text)',
        'field-line': 'var(--field-line)',
        success: 'var(--success)',
        warning: 'var(--warning)',
      },
      borderRadius: {
        card: '16px',
        sheet: '24px',
      },
    },
  },
  plugins: [],
};
