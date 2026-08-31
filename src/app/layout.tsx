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
        <div className="flex flex-1">
          <NavBar />
          <div className="flex min-w-0 flex-1 flex-col">
            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
            <Footer />
          </div>
        </div>
      </body>
    </html>
  );
}
