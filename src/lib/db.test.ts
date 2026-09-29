import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import nextConfig from "../../next.config";

const WASM = "./node_modules/.prisma/client/query_compiler_bg.wasm";

describe("empaquetado del cliente Prisma", () => {
  it("con engineType client, el compilador WASM se incluye en la raíz y en todas las rutas", () => {
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    if (!/engineType\s*=\s*"client"/.test(schema)) return;
    const includes = nextConfig.outputFileTracingIncludes ?? {};
    expect(includes["/"]).toContain(WASM);
    expect(includes["/**/*"]).toContain(WASM);
  });
});
