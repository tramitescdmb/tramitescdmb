import { redirect } from "next/navigation";

/** El calendario laboral se movió al SGDEA (Configuración → Calendario laboral). */
export default function CalendarioLaboralRedirect() {
  redirect("/correspondencia/calendario-laboral");
}
