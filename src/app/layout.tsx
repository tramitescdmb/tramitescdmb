import type { Metadata } from "next";
import { Cascaron } from "@/components/Cascaron";
import localFont from "next/font/local";
import { NavBar, BarraSuperiorSesion } from "@/components/NavBar";
import { FranjaGovCo } from "@/components/FranjaGovCo";
import { Footer } from "@/components/Footer";
import { PublicShellHeader } from "@/components/PublicShellHeader";
import { cookies } from "next/headers";
import { COOKIE_TEMA_MENU, temaMenuValido } from "@/lib/tema-menu";
import "./globals.css";

const inter = localFont({
  src: [
    { path: "./fonts/inter-latin.woff2", weight: "100 900", style: "normal" },
    { path: "./fonts/inter-italic-latin.woff2", weight: "100 900", style: "italic" },
  ],
  variable: "--font-sans",
  display: "swap",
});

// Tipografía de Negocios Verdes (Work Sans, licencia OFL: fonts/WorkSans-OFL.txt). Solo la usan sus páginas.
const workSans = localFont({
  src: [
    { path: "./fonts/worksans-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/worksans-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/worksans-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "./fonts/worksans-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-nv",
  display: "swap",
  preload: false,
});

// Todas las páginas dependen de la sesión y de la base (ya eran dinámicas en Next 15). Next 16 intenta
// prerenderizarlas en el build y, si la base no responde (como en el CI), el build falla; así se declara
// de una vez que nada se genera en el build y que nada consulta la base al compilar.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SIC CDMB",
  description: "Gestión de trámites ambientales de la CDMB",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Color del menú lateral que escogió la persona (cookie); el predeterminado es el verde institucional.
  const temaMenu = temaMenuValido((await cookies()).get(COOKIE_TEMA_MENU)?.value);
  return (
    <html lang="es" className={`${inter.variable} ${workSans.variable}`} data-tema-menu={temaMenu}>
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
