import { describe, it, expect } from "vitest";
import { interpretarUserAgent } from "@/lib/user-agent";

describe("interpretarUserAgent (MoReq 6.7)", () => {
  it("Chrome en Windows escritorio", () => {
    const r = interpretarUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    );
    expect(r).toEqual({ navegador: "Chrome", dispositivo: "Escritorio · Windows" });
  });

  it("Safari en iPhone", () => {
    const r = interpretarUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    );
    expect(r.navegador).toBe("Safari");
    expect(r.dispositivo).toBe("Móvil · iOS");
  });

  it("Chrome en Android tableta", () => {
    const r = interpretarUserAgent(
      "Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    );
    expect(r.dispositivo).toBe("Tableta · Android");
  });

  it("Firefox en Linux", () => {
    const r = interpretarUserAgent("Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0");
    expect(r).toEqual({ navegador: "Firefox", dispositivo: "Escritorio · Linux" });
  });

  it("Edge se distingue de Chrome", () => {
    expect(
      interpretarUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 Edg/120.0"
      ).navegador
    ).toBe("Edge");
  });

  it("sin user-agent devuelve guiones", () => {
    expect(interpretarUserAgent(null)).toEqual({ navegador: "—", dispositivo: "—" });
  });
});
