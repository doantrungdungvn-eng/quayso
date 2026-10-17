import { redirect } from "next/navigation";
import LuckyWheelApp from "@/components/LuckyWheelApp";

export default function Page({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  if (searchParams?.page === "register") {
    const params = new URLSearchParams();
    for (const key of ["eventName", "eventDate", "eventTime"]) {
      const value = searchParams[key];
      if (typeof value === "string" && value) params.set(key, value);
    }
    redirect(`/register${params.size ? `?${params.toString()}` : ""}`);
  }
  return <LuckyWheelApp />;
}
