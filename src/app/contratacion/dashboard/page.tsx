import { redirect } from "next/navigation";

/** El dashboard pasó a ser una vista del tablero de SIGEC (anillo «Indicadores»). */
export default function DashboardContratacionRedirigir() {
  redirect("/contratacion/panel/indicadores");
}
