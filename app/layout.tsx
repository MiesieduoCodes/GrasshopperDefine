import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import "./globals.css"

export const metadata: Metadata = {
  title: "Grasshopper Runner - Visualize Grasshopper Definitions",
  description: "Upload, visualize, and interact with Grasshopper definitions in real-time 3D",
  keywords: ["Grasshopper", "3D", "Visualization", "Rhino", "Parametric Design"],
  authors: [{ name: "Grasshopper Runner" }],
  viewport: "width=device-width, initial-scale=1",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <style>{`
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
}
        `}</style>
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
