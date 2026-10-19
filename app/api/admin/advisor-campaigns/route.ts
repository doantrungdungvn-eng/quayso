import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const expectedPin = process.env.ADMIN_PIN;
  const suppliedPin = request.headers.get("x-admin-pin");
  if (!expectedPin || !suppliedPin || suppliedPin !== expectedPin) {
    return NextResponse.json({ error: "Không được phép tạo đợt khảo sát. Hãy kiểm tra PIN quản trị trên Vercel." }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Máy chủ chưa cấu hình Supabase service key." }, { status: 503 });
  }

  let body: { name?: unknown; survey_date?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const surveyDate = body.survey_date === null || body.survey_date === "" || body.survey_date === undefined
    ? null
    : typeof body.survey_date === "string" ? body.survey_date : "invalid";
  if (!name || name.length > 160 || surveyDate === "invalid" || (surveyDate && !/^\d{4}-\d{2}-\d{2}$/.test(surveyDate))) {
    return NextResponse.json({ error: "Tên đợt khảo sát hoặc ngày khảo sát không hợp lệ." }, { status: 400 });
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase
    .from("lwv_advisor_campaigns")
    .insert({ name, survey_date: surveyDate, active: true })
    .select("id,name,survey_date,active,created_at")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Không tạo được đợt khảo sát. Hãy kiểm tra đã chạy migration lwv_advisor_campaigns trong Supabase chưa." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, campaign: data }, { status: 201, headers: { "Cache-Control": "no-store, max-age=0" } });
}
