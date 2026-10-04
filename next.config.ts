import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/": ["./node_modules/.prisma/client/query_compiler_bg.wasm"],
    "/**/*": ["./node_modules/.prisma/client/query_compiler_bg.wasm"],
    "/api/fondo-historico/extractor": ["./scripts/fondo-historico/*.sh", "./scripts/fondo-historico/*.cgi"],
  },
  async redirects() {
    return [{ source: "/geovisor", destination: "/visor-tramites", permanent: true }];
  },
};

export default nextConfig;
