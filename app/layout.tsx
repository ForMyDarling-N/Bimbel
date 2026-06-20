import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Bimbel Prestasi',
  description: 'Sistem Bimbingan Belajar Online',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  )
}
