import { redirect } from "next/navigation";

/** Los memorandos pasaron a su propio módulo. */
export default async function MemorandosAntiguo({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const { vista } = await searchParams;
  redirect(vista ? `/memorandos?vista=${encodeURIComponent(vista)}` : "/memorandos");
}
