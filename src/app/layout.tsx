import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "Game Arena - Casino Betting Platform",
  description: "In-game currency betting platform for tech events. Play Limbo, Dice, Mines, and Moles to grow your team balance!",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#17202b',
                color: '#d9e3f2',
                border: '1px solid rgba(0, 231, 1, 0.15)',
                borderRadius: '16px',
                fontSize: '14px',
                fontFamily: "'Inter', sans-serif",
                backdropFilter: 'blur(20px)',
                boxShadow: '0 0 40px rgba(0, 231, 1, 0.04), 0 8px 24px rgba(0, 0, 0, 0.3)',
              },
              success: {
                style: { border: '1px solid rgba(0, 231, 1, 0.2)', color: '#7dff67' },
                iconTheme: { primary: '#00e701', secondary: '#0a141e' },
              },
              error: {
                style: { border: '1px solid rgba(255, 180, 171, 0.25)', color: '#ffb4ab' },
                iconTheme: { primary: '#ffb4ab', secondary: '#0a141e' },
              },
            }}
          />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
