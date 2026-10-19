import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "Máy chủ chưa cấu hình Supabase." }, { status: 503 });
  const campaignId = new URL(request.url).searchParams.get("campaign") || "";
  if (!campaignId) return NextResponse.json({ error: "Thiếu mã đợt khảo sát." }, { status: 400 });
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.from("lwv_advisor_campaigns").select("id,name,survey_date,active").eq("id", campaignId).eq("active", true).single();
  if (error || !data) return NextResponse.json({ error: "Đợt khảo sát không tồn tại hoặc đã đóng." }, { status: 404 });
  return NextResponse.json({ campaign: data }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "Máy chủ chưa cấu hình Supabase. Vui lòng báo ban quản trị." }, { status: 503 });
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 }); }
  const campaignId = String(body.campaign_id || "").trim();
  if (!campaignId) return NextResponse.json({ error: "Thiếu mã đợt khảo sát. Vui lòng mở đúng link QR của đợt." }, { status: 400 });
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: campaign, error: campaignError } = await supabase.from("lwv_advisor_campaigns").select("id,name,active").eq("id", campaignId).eq("active", true).single();
  if (campaignError || !campaign) return NextResponse.json({ error: "Đợt khảo sát không tồn tại hoặc đã đóng." }, { status: 404 });
  const full_name = String(body.full_name || "").trim();
  const phone = String(body.phone || "").trim();
  const agency = String(body.agency || "").trim();
  if (!full_name || !phone || !agency || body.consent !== true) return NextResponse.json({ error: "Vui lòng điền họ tên, số điện thoại, đơn vị/nhóm và xác nhận thông tin." }, { status: 400 });
  const row = {
    id: crypto.randomUUID(), full_name, phone, customer_code: null, advisor_name: full_name, agency,
    survey_rating: 0, survey_interest: "Cam kết kinh doanh TVV",
    survey_feedback: JSON.stringify({ commitment: String(body.commitment || "").trim(), revenue: String(body.revenue || "").trim(), recruit: String(body.recruit || "").trim(), notes: String(body.notes || "").trim() }),
    consent: true, eligible: true, event_name: "__TVV_SURVEY__", advisor_campaign_id: campaign.id, event_date: null, event_time: null, appointment_date: null
  };
  const { error } = await supabase.from("lwv_customers").insert(row);
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "Số điện thoại này đã đăng ký trong đợt khảo sát này hoặc trùng dữ liệu hiện có." }, { status: 409 });
    return NextResponse.json({ error: "Không lưu được khảo sát. Kiểm tra bảng lwv_customers và thử lại." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, message: `Đã ghi nhận khảo sát: ${campaign.name}.` }, { status: 201 });
}
