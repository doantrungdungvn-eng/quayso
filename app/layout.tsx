import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Lucky Wheel VIP | Tri Ân Khách Hàng",
  description: "Đăng ký khách hàng, khảo sát và quay thưởng sự kiện Tri Ân Khách Hàng VIP."
};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="vi"><body>{children}</body></html>;
}