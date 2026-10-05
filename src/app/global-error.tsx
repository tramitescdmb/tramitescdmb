"use client";

import "./globals.css";
import { ErrorRecuperable } from "@/components/ErrorRecuperable";

export default function ErrorGlobal({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-stone-50 px-4 text-stone-900 antialiased">
        <ErrorRecuperable error={error} reset={reset} />
      </body>
    </html>
  );
}
