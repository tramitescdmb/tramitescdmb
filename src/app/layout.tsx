import type { Metadata } from "next";
import { headers } from "next/headers";
import { IBM_Plex_Sans } from "next/font/google";
import { NavBar } from "@/components/NavBar";
import { FranjaGovCo } from "@/components/FranjaGovCo";
import { Footer } from "@/components/Footer";
import { PublicShellHeader } from "@/components/PublicShellHeader";
import "./globals.css";

// Reemplaza la fuente del sistema por una pensada para lectura prolongada en
// pantalla (funcionarios que usan la app varias horas seguidas) con carácter
// más institucional que un sans-serif genérico.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
  // La ventanilla pública (PQRSD) se sirve sin la navegación interna: quien la
  // usa es un ciudadano, no un funcionario. El pathname llega por header desde
  // el middleware.
  const pathname = (await headers()).get("x-pathname") ?? "";
  const publico = pathname === "/pqrsd" || pathname.startsWith("/pqrsd/");

  return (
    <html lang="es" className={plexSans.variable}>
      <body className="flex min-h-screen flex-col text-stone-900 antialiased" suppressHydrationWarning>
        <div className="print:hidden">
          <FranjaGovCo />
        </div>

        {publico ? (
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="print:hidden">
              <PublicShellHeader />
            </div>
            <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 lg:py-8 print:max-w-none print:p-0">{children}</main>
            <div className="print:hidden">
              <Footer />
            </div>
          </div>
        ) : (
          <div className="flex flex-1">
            <div className="print:hidden">
              <NavBar />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:max-w-none print:p-0">{children}</main>
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
