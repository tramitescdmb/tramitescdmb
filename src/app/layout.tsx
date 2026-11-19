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

// Todas las páginas dependen de la sesión y de la base (ya eran dinámicas en Next 15). Next 16 intenta
// prerenderizarlas en el build y, si la base no responde (como en el CI), el build falla; así se declara
// de una vez que nada se genera en el build y que nada consulta la base al compilar.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SIC CDMB",
  description: "Gestión de solicitudes ambientales de la CDMB",
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
