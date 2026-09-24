import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/fondo-historico/extractor": ["./scripts/fondo-historico/*.sh", "./scripts/fondo-historico/*.cgi"],
  },
};

export default nextConfig;
