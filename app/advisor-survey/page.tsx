import { Suspense } from "react";
import AdvisorSurveyClient from "./AdvisorSurveyClient";

export default function AdvisorSurveyPage() {
  return (
    <Suspense fallback={<main className="app-shell" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>Đang tải khảo sát...</main>}>
      <AdvisorSurveyClient />
    </Suspense>
  );
}
