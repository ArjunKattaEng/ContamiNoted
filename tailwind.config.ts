import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'
import plugin from 'tailwindcss/plugin'

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  future: {
    // Only apply `hover:` on devices with a real pointer, so iOS taps don't stick in a hover state
    hoverOnlyWhenSupported: true,
  },
  theme: {
    extend: {
      screens: {
        // Desktop layout (sidebar, multi-column) needs a wide screen AND a mouse/trackpad, so tablets
        // (and the iOS app on iPad) keep the touch layout. Narrow desktop windows get the phone layout.
        // Must stay in sync with DESKTOP_QUERY in src/hooks/use-media-query.ts.
        desktop: { raw: '(min-width: 1024px) and (hover: hover) and (pointer: fine)' },
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
          soft: 'hsl(var(--destructive-soft))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          soft: 'hsl(var(--success-soft))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          soft: 'hsl(var(--warning-soft))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      spacing: {
        // iOS notch / home-indicator insets; 0 in desktop browsers
        'safe-top': 'var(--safe-top)',
        'safe-bottom': 'var(--safe-bottom)',
      },
    },
  },
  plugins: [
    animate,
    // `native:` styles apply inside the Capacitor app, `web:` in a browser (see main.tsx)
    plugin(({ addVariant }) => {
      addVariant('native', 'html.native &')
      addVariant('web', 'html:not(.native) &')
    }),
  ],
} satisfies Config
