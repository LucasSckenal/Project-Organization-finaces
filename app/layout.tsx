import type { Metadata, Viewport } from 'next'
import { Inter, Noto_Serif_JP } from 'next/font/google'
import { AuthProvider }  from '@/contexts/AuthContext'
import { ToastProvider }  from '@/contexts/ToastContext'
import { ThemeProvider }  from '@/contexts/ThemeContext'
import { SoundProvider }  from '@/contexts/SoundContext'
import { BootScreen }     from '@/components/ui/BootScreen/BootScreen'
import './globals.scss'

const inter = Inter({
  subsets:  ['latin'],
  variable: '--font-inter',
  display:  'swap',
  weight:   ['300', '400', '500'],
})

const notoSerif = Noto_Serif_JP({
  subsets:  ['latin'],
  variable: '--font-noto',
  display:  'swap',
  weight:   ['300', '400', '500'],
})

export const metadata: Metadata = {
  title:       'Ma · Finance OS',
  description: 'A cinematic personal finance operating system.',
  icons:       { icon: '/icon.svg', apple: '/icon.svg' },
  manifest:    '/manifest.json',
  appleWebApp: {
    capable:         true,
    statusBarStyle:  'black-translucent',
    title:           'Ma',
  },
  other: { 'mobile-web-app-capable': 'yes' },
}

export const viewport: Viewport = {
  themeColor:  '#1A1816',
  colorScheme: 'dark',
  width:       'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${notoSerif.variable}`} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <SoundProvider>
            <AuthProvider>
              <ToastProvider>
                <BootScreen />
                {children}
              </ToastProvider>
            </AuthProvider>
          </SoundProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
