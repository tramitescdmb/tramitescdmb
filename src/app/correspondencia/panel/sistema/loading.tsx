import { EsqueletoTablero } from "@/components/sgdea/ui";

/** Se muestra al instante mientras esta página resuelve sus datos (convención `loading.tsx` de
 * Next.js) — antes no había ninguna, así que un clic quedaba en blanco hasta que la navegación
 * terminaba, dando la sensación de que la plataforma no respondía. */
export default function Cargando() {
  return <EsqueletoTablero />;
}
