import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function CalendarioLaboralRedirect() {
  redirect("/correspondencia/calendario-laboral");
}
