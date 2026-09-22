import { redirect } from "next/navigation";

/** La entrada de SIGEC es su tablero (con vistas de trabajo pendiente, expedientes, indicadores y sistema). */
export default function ContratacionInicioPage() {
  redirect("/contratacion/panel");
}
