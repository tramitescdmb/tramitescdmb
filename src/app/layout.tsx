import type { Metadata } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import { NavBar } from "@/components/NavBar";
import { FranjaGovCo } from "@/components/FranjaGovCo";
import { Footer } from "@/components/Footer";
import { PublicShellHeader } from "@/components/PublicShellHeader";
import "./globals.css";

const workSans = localFont({
  src: [
    { path: "./fonts/work-sans-latin.woff2", weight: "100 900", style: "normal" },
    { path: "./fonts/work-sans-italic-latin.woff2", weight: "100 900", style: "italic" },
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
  const pathname = (await headers()).get("x-pathname") ?? "";
  const publico =
    pathname === "/pqrsd" || pathname.startsWith("/pqrsd/") || pathname.startsWith("/verificar/") || pathname === "/validar-firma";

  return (
    <html lang="es" className={workSans.variable}>
      <body className="flex min-h-screen flex-col text-stone-900 antialiased" suppressHydrationWarning>
        <div className="print:hidden">
          <FranjaGovCo />
        </div>

        {publico ? (
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="print:hidden">
              <PublicShellHeader />
            </div>
            <main
              className={`mx-auto w-full flex-1 px-4 py-6 sm:px-6 lg:py-8 print:max-w-none print:p-0 ${
                pathname === "/validar-firma" ? "max-w-6xl" : "max-w-3xl"
              }`}
            >
              {children}
            </main>
            <div className="print:hidden">
              <Footer />
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col lg:flex-row">
            <div className="print:hidden">
              <NavBar />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <main className="w-full flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:max-w-none print:p-0">{children}</main>
              <div className="print:hidden">
                <Footer />
              </div>
            </div>
          </div>
        )}
      </body>
    </html>
  );
}
