import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { ValidadorFirmas } from "@/components/ValidadorFirmas";

export const metadata: Metadata = { title: "Validador de firmas electrónicas — CDMB" };

export default function ValidarFirmaPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-cdmb-100 text-cdmb-700">
          <ShieldCheck className="h-5 w-5" aria-hidden />
        </span>
        <h1 className="text-xl font-semibold text-stone-900">Validador de firmas electrónicas</h1>
      </div>
      <ValidadorFirmas />
    </div>
  );
}
