import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { ValidadorFirmas } from "@/components/ValidadorFirmas";
import { CabeceraTablero } from "@/components/tablero";

export const metadata: Metadata = { title: "Validador de firmas electrónicas — CDMB" };

export default async function ValidarFirmaPage({ searchParams }: { searchParams: Promise<{ csv?: string }> }) {
  const { csv } = await searchParams;
  return (
    <div className="space-y-4">
      <CabeceraTablero icon={ShieldCheck} titulo="Validador de firmas electrónicas" descripcion="Verifique la autenticidad de un documento firmado con su código de verificación (CSV) o su archivo." />
      <ValidadorFirmas csvInicial={typeof csv === "string" ? csv : ""} />
    </div>
  );
}
