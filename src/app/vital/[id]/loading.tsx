import { EsqueletoDetalle } from "@/components/sgdea/ui";

// Respuesta inmediata al hacer clic en un ID VITAL: sin esto la lista parecía
// no reaccionar mientras se armaba la ficha y la persona volvía a hacer clic.
export default function Cargando() {
  return <EsqueletoDetalle />;
}
