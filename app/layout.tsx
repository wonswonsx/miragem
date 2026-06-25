import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { AgeGateModal } from "@/components/AgeGateModal";
import { WhatsAppFloatButton } from "@/components/WhatsAppFloatButton";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "Explorar · Miragem Fantasia",
  description: "Galeria de referências e geração — Miragem Fantasia",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body
        className={`${inter.className} ${jetbrainsMono.variable} min-h-screen antialiased`}
      >
        <AgeGateModal />
        <WhatsAppFloatButton />
        {children}
      </body>
    </html>
  );
}
