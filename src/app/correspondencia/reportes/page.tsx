import { redirect } from "next/navigation";

/** El contenido de Reportes se unificó en el Panel del SGDEA. */
export default function ReportesRedirect() {
  redirect("/correspondencia/panel");
}
