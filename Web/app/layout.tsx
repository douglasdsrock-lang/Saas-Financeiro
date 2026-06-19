import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/hooks/use-auth";
import ErrorBoundary from "@/components/error-boundary";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-sans",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "SaaS Financeiro",
  description: "Gestão financeira inteligente",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${inter.variable} ${outfit.variable}`}>
      <body className="font-sans bg-background text-foreground min-h-screen relative overflow-x-hidden antialiased">
        {/* Ambient Glow Blobs */}
        <div className="fixed top-[-20%] right-[-10%] w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] rounded-full bg-emerald-500/[0.04] blur-[130px] pointer-events-none z-0" />
        <div className="fixed bottom-[-10%] left-[-20%] w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] rounded-full bg-cyan-500/[0.03] blur-[130px] pointer-events-none z-0" />
        
        <div className="relative z-10">
          <ErrorBoundary>
            <AuthProvider>
              {children}
            </AuthProvider>
          </ErrorBoundary>
        </div>
      </body>
    </html>
  );
}
