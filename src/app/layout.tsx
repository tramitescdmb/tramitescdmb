import type { Metadata } from "next";
import { NavBar } from "@/components/NavBar";
import { FranjaGovCo } from "@/components/FranjaGovCo";
import { Footer } from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trámites CDMB",
  description: "Gestión de trámites ambientales de la CDMB",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="flex min-h-screen flex-col text-stone-900 antialiased" suppressHydrationWarning>
        <FranjaGovCo />
        <NavBar />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
