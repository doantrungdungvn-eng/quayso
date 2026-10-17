import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const expectedPin = process.env.ADMIN_PIN;
  const suppliedPin = request.headers.get("x-admin-pin");
  if (!expectedPin || !suppliedPin || suppliedPin !== expectedPin) {
    return NextResponse.json({ error: "Không được phép đồng bộ. Hãy đặt ADMIN_PIN trên Vercel và dùng đúng PIN quản trị." }, { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "Máy chủ chưa cấu hình SUPABASE_SERVICE_ROLE_KEY." }, { status: 503 });

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const [customers, prizes, winners] = await Promise.all([
    supabase.from("lwv_customers").select("*").order("created_at", { ascending: false }),
    supabase.from("lwv_prizes").select("*"),
    supabase.from("lwv_winners").select("*").order("won_at", { ascending: false })
  ]);
  if (customers.error || prizes.error || winners.error) {
    return NextResponse.json({ error: "Không đọc được dữ liệu Supabase. Kiểm tra các bảng lwv_customers, lwv_prizes và lwv_winners." }, { status: 500 });
  }
  return NextResponse.json({ customers: customers.data || [], prizes: prizes.data || [], winners: winners.data || [] }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
