import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import SpookyDecor from "@/components/SpookyDecor";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "Curse the Code - Hollow House Arena",
  description: "Thirty years ago tonight, the Vance family vanished from Hollow House. Play the cursed games, grow your balance, and survive until midnight.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Creepster&family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <a href="#main-content" className="skip-link">Skip to content</a>
        <SpookyDecor />
        <AuthProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#1a1026',
                color: '#eadfff',
                border: '1px solid rgba(255, 122, 26, 0.15)',
                borderRadius: '16px',
                fontSize: '14px',
                fontFamily: "'Inter', sans-serif",
                backdropFilter: 'blur(20px)',
                boxShadow: '0 0 40px rgba(255, 122, 26, 0.04), 0 8px 24px rgba(0, 0, 0, 0.3)',
              },
              success: {
                style: { border: '1px solid rgba(255, 122, 26, 0.2)', color: '#ffa347' },
                iconTheme: { primary: '#ff7a1a', secondary: '#0b0612' },
              },
              error: {
                style: { border: '1px solid rgba(255, 180, 171, 0.25)', color: '#ffb4ab' },
                iconTheme: { primary: '#ffb4ab', secondary: '#0b0612' },
              },
            }}
          />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
