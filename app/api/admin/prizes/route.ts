import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  const expectedPin = process.env.ADMIN_PIN;
  const suppliedPin = request.headers.get("x-admin-pin");
  if (!expectedPin || !suppliedPin || suppliedPin !== expectedPin) {
    return NextResponse.json({ error: "Không được phép xóa giải thưởng. Hãy kiểm tra PIN quản trị." }, { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Máy chủ chưa cấu hình Supabase service key." }, { status: 503 });
  }
  let body: { id?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Dữ liệu yêu cầu không hợp lệ." }, { status: 400 });
  }
  const prizeId = typeof body.id === "string" ? body.id.trim() : "";
  if (!prizeId) return NextResponse.json({ error: "Thiếu mã giải thưởng." }, { status: 400 });

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await supabase.from("lwv_prizes").delete().eq("id", prizeId);
  if (error) return NextResponse.json({ error: "Không thể xóa giải thưởng khỏi Supabase." }, { status: 500 });
  return NextResponse.json({ ok: true, id: prizeId }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
