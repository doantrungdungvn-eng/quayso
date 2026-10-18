import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Máy chủ chưa cấu hình SUPABASE_SERVICE_ROLE_KEY. Hãy thêm biến này trên Vercel rồi Redeploy." }, { status: 503 });
  }
  let body: any;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 }); }

  const full_name = String(body.full_name || "").trim();
  const phone = String(body.phone || "").trim();
  if (!full_name || !phone || body.consent !== true) {
    return NextResponse.json({ error: "Vui lòng nhập họ tên, số điện thoại và xác nhận đồng ý." }, { status: 400 });
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const normalizedPhone = phone.replace(/\s/g, "");
  const { data: existing, error: lookupError } = await supabase.from("lwv_customers").select("id,phone,created_at");
  if (lookupError) return NextResponse.json({ error: "Không kiểm tra được dữ liệu khách hàng. Kiểm tra bảng lwv_customers." }, { status: 500 });
  if ((existing || []).some((row: {phone:string}) => String(row.phone || "").replace(/\s/g, "") === normalizedPhone)) {
    return NextResponse.json({ error: "Số điện thoại này đã đăng ký. Vui lòng liên hệ ban tổ chức nếu cần cập nhật." }, { status: 409 });
  }

  // Mã khách hàng: DDMMSS, dùng ngày đăng ký theo giờ Việt Nam và số thứ tự trong ngày.
  // Ví dụ đăng ký ngày 18/10: 181001, 181002, 181003...
  const now = new Date();
  const vietnamDate = new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const dayMonth = vietnamDate.slice(8, 10) + vietnamDate.slice(5, 7);
  const todayCount = (existing || []).filter((item: { created_at?: string | null }) => {
    if (!item.created_at) return false;
    return new Date(new Date(item.created_at).getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10) === vietnamDate;
  }).length;
  const customerCode = `${dayMonth}${String(todayCount + 1).padStart(2, "0")}`;

  const row = {
    id: String(body.id || crypto.randomUUID()), full_name, phone,
    customer_code: customerCode,
    advisor_name: String(body.advisor_name || "").trim() || null,
    agency: String(body.agency || "").trim() || null,
    survey_rating: Number(body.survey_rating || 5),
    survey_interest: String(body.survey_interest || "").trim() || null,
    survey_feedback: String(body.survey_feedback || "").trim() || null,
    consent: true, eligible: true,
    event_name: String(body.event_name || "").trim() || null,
    event_date: String(body.event_date || "").trim() || null,
    event_time: String(body.event_time || "").trim() || null,
    appointment_date: String(body.appointment_date || "").trim() || null
  };
  const { error } = await supabase.from("lwv_customers").insert(row);
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Số điện thoại này đã đăng ký." }, { status: 409 });
    return NextResponse.json({ error: "Không lưu được đăng ký vào Supabase. Kiểm tra cấu trúc bảng." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, message: "Đăng ký thành công.", customer_code: customerCode }, { status: 201 });
}
