import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Alpha VW — Enterprise Batch Topology & Job Monitoring",
  description:
    "Modern enterprise batch processing dashboard, visual flow topology canvas, and job scheduling management platform.",
  keywords: ["Alpha VW", "batch processing", "topology", "job monitoring", "enterprise"],
  authors: [{ name: "Alpha VW Team" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light" data-density="compact" suppressHydrationWarning>
      <body
        className={`${ibmPlexSans.variable} ${ibmPlexMono.variable} font-sans antialiased`}
      >
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              borderRadius: 0,
              border: "1px solid var(--border-strong)",
              background: "var(--surface)",
              color: "var(--text)",
              boxShadow: "none",
            },
          }}
        />
      </body>
    </html>
  );
}
