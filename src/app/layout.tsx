import type { Metadata } from "next";
import { Cascaron } from "@/components/Cascaron";
import localFont from "next/font/local";
import { NavBar, BarraSuperiorSesion } from "@/components/NavBar";
import { FranjaGovCo } from "@/components/FranjaGovCo";
import { Footer } from "@/components/Footer";
import { PublicShellHeader } from "@/components/PublicShellHeader";
import "./globals.css";

const inter = localFont({
  src: [
    { path: "./fonts/inter-latin.woff2", weight: "100 900", style: "normal" },
    { path: "./fonts/inter-italic-latin.woff2", weight: "100 900", style: "italic" },
  ],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Trámites CDMB",
  description: "Gestión de trámites ambientales de la CDMB",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="flex min-h-screen flex-col text-stone-900 antialiased" suppressHydrationWarning>
        <div className="print:hidden">
          <FranjaGovCo />
        </div>

        <Cascaron navBar={<NavBar />} barraSuperior={<BarraSuperiorSesion />} encabezadoPublico={<PublicShellHeader />} pie={<Footer />}>
          {children}
        </Cascaron>
      </body>
    </html>
  );
}
