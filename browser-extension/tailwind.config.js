/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{tsx,ts,jsx,js,html,svelte}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--nenspace-border))",
        input: "hsl(var(--nenspace-input))",
        ring: "hsl(var(--nenspace-ring))",
        background: "hsl(var(--nenspace-background))",
        foreground: "hsl(var(--nenspace-foreground))",
        primary: {
          DEFAULT: "hsl(var(--nenspace-primary))",
          foreground: "hsl(var(--nenspace-primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--nenspace-secondary))",
          foreground: "hsl(var(--nenspace-secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--nenspace-destructive))",
          foreground: "hsl(var(--nenspace-destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--nenspace-muted))",
          foreground: "hsl(var(--nenspace-muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--nenspace-accent))",
          foreground: "hsl(var(--nenspace-accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--nenspace-popover))",
          foreground: "hsl(var(--nenspace-popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--nenspace-card))",
          foreground: "hsl(var(--nenspace-card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--nenspace-radius)",
        md: "calc(var(--nenspace-radius) - 2px)",
        sm: "calc(var(--nenspace-radius) - 4px)",
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin': 'spin 0.8s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        spin: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
    },
  },
  plugins: [],
}

