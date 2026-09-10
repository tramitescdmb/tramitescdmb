import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El endpoint /api/fondo-historico/extractor sirve el .sh de extracción para
  // que un equipo de la red CDMB lo baje con curl (sin git ni pscp).
  outputFileTracingIncludes: {
    "/api/fondo-historico/extractor": ["./scripts/fondo-historico/*.sh", "./scripts/fondo-historico/*.cgi"],
  },
};

export default nextConfig;
