import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@/components/providers/clerk-provider";
import { ConvexClientProvider } from "@/components/providers/convex-provider";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "TechStaple — Dutch Tech Intelligence",
  description: "All the reports on Dutch tech, stapled together. Search, analyze, and chat with ecosystem reports.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ClerkProvider>
          <ConvexClientProvider>
            {children}
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
