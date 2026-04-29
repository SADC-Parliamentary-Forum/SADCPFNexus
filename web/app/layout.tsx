import type { Metadata } from "next";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { PrefsProvider } from "@/components/providers/PrefsProvider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ConfirmProvider } from "@/components/ui/ConfirmDialog";
import { RouteProgressBar } from "@/components/ui/RouteProgressBar";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "SADC PF Nexus",
  description: "SADC Parliamentary Forum Governance Platform",
  icons: {
    icon: "/sadcpf-logo.png",
    shortcut: "/sadcpf-logo.png",
    apple: "/sadcpf-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* eslint-disable-next-line @next/next/no-before-interactive-script-outside-document */}
        <script
          id="theme-bootstrap"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('sadcpf_theme');if(t==='dark'){document.documentElement.classList.add('dark');document.documentElement.setAttribute('data-theme','dark');}}catch(e){}})();`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Public+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen" suppressHydrationWarning>
        <ThemeProvider>
          <AuthProvider>
            <PrefsProvider>
              <QueryProvider>
                <ToastProvider>
                  <ConfirmProvider>
                    <RouteProgressBar />
                    {children}
                  </ConfirmProvider>
                </ToastProvider>
              </QueryProvider>
            </PrefsProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
