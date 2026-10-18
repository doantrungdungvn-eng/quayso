import { Suspense } from "react";
import RegisterForm from "./RegisterForm";

export default function RegisterPage() {
  return (
    <Suspense fallback={<main className="app-shell"><div className="panel" style={{ padding: 24 }}>Đang tải biểu mẫu đăng ký…</div></main>}>
      <RegisterForm />
    </Suspense>
  );
}
