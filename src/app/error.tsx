"use client";

import { ErrorRecuperable } from "@/components/ErrorRecuperable";

export default function ErrorDePagina({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorRecuperable error={error} reset={reset} />;
}
