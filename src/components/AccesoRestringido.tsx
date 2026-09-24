import Link from "next/link";
import { Lock } from "lucide-react";

export function AccesoRestringido({
  titulo,
  quien = "administrador",
  volverHref,
  volverLabel = "Volver",
}: {
  titulo: string;
  quien?: string;
  volverHref?: string;
  volverLabel?: string;
}) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-soft">
      <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 text-stone-400">
        <Lock className="h-5 w-5" aria-hidden />
      </span>
      <h1 className="text-base font-semibold text-stone-900">{titulo}</h1>
      <p className="mt-1 text-sm font-medium text-stone-700">Acceso restringido — solo {quien}.</p>
      <p className="mt-2 text-sm text-stone-500">
        Esta sección forma parte de la administración del sistema y no está habilitada para su usuario. Si necesita
        usarla, solicite el acceso a un {quien}.
      </p>
      {volverHref && (
        <Link href={volverHref} className="mt-5 inline-flex rounded-md border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50">
          {volverLabel}
        </Link>
      )}
    </div>
  );
}
