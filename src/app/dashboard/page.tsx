import LandingPage from "@/app/page";

export default function DashboardPage() {
  return <LandingPage searchParams={Promise.resolve({ vista: "general" })} />;
}
