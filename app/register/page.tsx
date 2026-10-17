import RegisterForm from "./RegisterForm";

type SearchParams = Record<string, string | string[] | undefined>;

export default function RegisterPage({ searchParams }: { searchParams?: SearchParams }) {
  const get = (key: string) => {
    const value = searchParams?.[key];
    return typeof value === "string" ? value : "";
  };

  return (
    <RegisterForm
      eventName={get("eventName") || "Sự kiện khách hàng"}
      eventDate={get("eventDate")}
      eventTime={get("eventTime")}
    />
  );
}
