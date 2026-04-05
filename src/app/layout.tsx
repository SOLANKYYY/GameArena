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
      <body>
        <AuthProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#1a2c38',
                color: '#fff',
                border: '1px solid #2f4553',
                borderRadius: '8px',
                fontSize: '14px',
              },
              success: {
                style: { border: '1px solid #00e701', color: '#00e701' },
                iconTheme: { primary: '#00e701', secondary: '#1a2c38' },
              },
              error: {
                style: { border: '1px solid #ed4163', color: '#ed4163' },
                iconTheme: { primary: '#ed4163', secondary: '#1a2c38' },
              },
            }}
          />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
