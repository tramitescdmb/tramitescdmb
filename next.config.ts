import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El despliegue compila en una carpeta aparte (NEXT_DIST_DIR=.next-nueva) y la cambia por .next solo
  // al terminar, justo antes de reiniciar: compilar encima de .next con la plataforma en marcha dejaba
  // páginas en «Internal Server Error» mientras duraba la compilación. Sin la variable se usa .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  outputFileTracingIncludes: {
    "/api/fondo-historico/extractor": ["./scripts/fondo-historico/*.sh", "./scripts/fondo-historico/*.cgi"],
  },
  // Cabeceras de seguridad para todas las respuestas. No se pone HSTS aquí: con el certificado
  // provisional de la IP fijaría el error de certificado en los navegadores; va en nginx cuando
  // esté el dominio con certificado válido. Tampoco una CSP de scripts, que rompería el visor.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // Las páginas solo se pueden incrustar en la propia plataforma (evita el clickjacking). Se
        // excluyen los archivos del almacén: llevan su propia CSP (sandbox para HTML/SVG subidos).
        source: "/((?!api/almacen/|negocios-verdes/geovisor/embed).*)",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors 'self'" }],
      },
      {
        // El geovisor público de Negocios Verdes se puede incrustar en las páginas de la CDMB (solo
        // consulta, sin sesión ni acciones). En navegadores actuales esta CSP prevalece sobre el
        // X-Frame-Options SAMEORIGIN que pone nginx.
        source: "/negocios-verdes/geovisor/embed",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors 'self' https://cdmb.gov.co https://*.cdmb.gov.co" }],
      },
    ];
  },
  async redirects() {
    return [{ source: "/geovisor", destination: "/visor-tramites", permanent: true }];
  },
};

export default nextConfig;
