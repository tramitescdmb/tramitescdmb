import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function DashboardContratacionRedirigir() {
  redirect("/contratacion/panel/indicadores");
}
