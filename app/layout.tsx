import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BottomNav } from "@/components/bottom-nav";
import { ServiceWorker } from "@/components/service-worker";

export const metadata: Metadata = {
  title: "DailyBulk",
  description: "Track calories, protein, creatine and bodyweight. Simple. Daily.",
  manifest: "/manifest.json",
  applicationName: "DailyBulk",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DailyBulk",
  },
  icons: {
    icon: "/icons/icon-512.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#070a12",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans text-white antialiased">
        <ServiceWorker />
        <main className="mx-auto min-h-dvh w-full max-w-md px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))]">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
