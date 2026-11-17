import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/": ["./node_modules/.prisma/client/query_compiler_bg.wasm"],
    "/**/*": ["./node_modules/.prisma/client/query_compiler_bg.wasm"],
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
        source: "/((?!api/almacen/).*)",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors 'self'" }],
      },
    ];
  },
  async redirects() {
    return [{ source: "/geovisor", destination: "/visor-tramites", permanent: true }];
  },
};

export default nextConfig;
