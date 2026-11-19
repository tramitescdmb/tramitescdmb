import { redirect } from "next/navigation";

/** Los memorandos pasaron a su propio módulo. */
export default async function NuevaInternaAntigua({ searchParams }: { searchParams: Promise<{ respondeAId?: string }> }) {
  const { respondeAId } = await searchParams;
  redirect(respondeAId ? `/memorandos/nuevo?respondeAId=${encodeURIComponent(respondeAId)}` : "/memorandos/nuevo");
}
