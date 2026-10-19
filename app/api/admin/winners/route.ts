import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const expectedPin = process.env.ADMIN_PIN;
  const suppliedPin = request.headers.get("x-admin-pin");
  if (!expectedPin || !suppliedPin || suppliedPin !== expectedPin) {
    return NextResponse.json({ error: "Không được phép lưu kết quả. Hãy kiểm tra PIN quản trị trên Vercel." }, { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "Máy chủ chưa cấu hình Supabase service key." }, { status: 503 });

  let body: { prizeId?: string; advisorMode?: boolean; winner?: { id?: string; customer_id?: string; full_name?: string; phone?: string; customer_code?: string; advisor_name?: string; prize_name?: string; won_at?: string } };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Dữ liệu kết quả không hợp lệ." }, { status: 400 }); }
  const prizeId = typeof body.prizeId === "string" ? body.prizeId.trim() : "";
  const w = body.winner;
  const advisorMode = body.advisorMode === true;
  if ((!advisorMode && !prizeId) || !w?.id || !w.customer_id || !w.full_name || !w.phone || !w.prize_name) return NextResponse.json({ error: "Thiếu thông tin giải thưởng hoặc người trúng thưởng." }, { status: 400 });

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: existingWinner, error: existingError } = await supabase.from("lwv_winners").select("id").eq("customer_id", w.customer_id).maybeSingle();
  if (existingError) return NextResponse.json({ error: `Không kiểm tra được lịch sử trúng thưởng: ${existingError.message}` }, { status: 500 });
  if (existingWinner) return NextResponse.json({ error: "Khách hàng này đã có kết quả trúng thưởng. Hãy đồng bộ dữ liệu trước khi quay tiếp." }, { status: 409 });

  let prize: { id: string; name: string; quantity: number; won: number; active: boolean } | null = null;
  if (!advisorMode) {
    const { data, error } = await supabase.from("lwv_prizes").select("id,name,quantity,won,active").eq("id", prizeId).single();
    if (error || !data) return NextResponse.json({ error: "Không tìm thấy giải thưởng trên Supabase. Hãy đồng bộ cơ cấu giải trước khi quay." }, { status: 404 });
    prize = data;
    if (!prize.active || Number(prize.won) >= Number(prize.quantity)) return NextResponse.json({ error: "Giải thưởng đã hết số lượng. Hãy đồng bộ và chọn giải còn lượt." }, { status: 409 });
  }
  const winnerRow = { id: w.id, customer_id: w.customer_id, full_name: w.full_name, phone: w.phone, customer_code: w.customer_code || "", advisor_name: w.advisor_name || "", prize_name: advisorMode ? "Quà tư vấn viên" : prize!.name, won_at: w.won_at || new Date().toISOString() };
  const { error: insertError } = await supabase.from("lwv_winners").insert(winnerRow);
  if (insertError) return NextResponse.json({ error: `Không thể lưu người trúng thưởng: ${insertError.message}` }, { status: 500 });
  if (advisorMode) return NextResponse.json({ ok: true, winner: winnerRow }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  const { data: updatedPrize, error: updateError } = await supabase.from("lwv_prizes").update({ won: Number(prize!.won) + 1 }).eq("id", prizeId).select("id,name,quantity,won,active").single();
  if (updateError || !updatedPrize) return NextResponse.json({ error: "Đã ghi người trúng nhưng chưa cập nhật được số lượng giải. Vui lòng kiểm tra Supabase trước lượt quay tiếp theo." }, { status: 500 });
  return NextResponse.json({ ok: true, winner: winnerRow, prize: updatedPrize }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

export async function DELETE(request: Request) {
  const expectedPin = process.env.ADMIN_PIN;
  const suppliedPin = request.headers.get("x-admin-pin");
  if (!expectedPin || !suppliedPin || suppliedPin !== expectedPin) {
    return NextResponse.json({ error: "Không được phép đặt lại kết quả. Hãy kiểm tra PIN quản trị trên Vercel." }, { status: 401 });
  }
  const requestUrl = new URL(request.url);
  const mode = requestUrl.searchParams.get("mode");
  const customerId = requestUrl.searchParams.get("customerId")?.trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "Máy chủ chưa cấu hình Supabase service key." }, { status: 503 });
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  if (mode === "advisors") {
    const { data: advisors, error: advisorError } = await supabase.from("lwv_customers").select("id").eq("event_name", "__TVV_SURVEY__");
    if (advisorError) return NextResponse.json({ error: `Không đọc được danh sách TVV: ${advisorError.message}` }, { status: 500 });
    const ids = (advisors || []).map((row: {id:string})=>row.id);
    if (ids.length) {
      const { error } = await supabase.from("lwv_winners").delete().in("customer_id", ids);
      if (error) return NextResponse.json({ error: `Không thể reset kết quả TVV: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  }
  if (!customerId) return NextResponse.json({ error: "Thiếu mã khách hàng cần đặt lại." }, { status: 400 });
  const { error } = await supabase.from("lwv_winners").delete().eq("customer_id", customerId);
  if (error) return NextResponse.json({ error: `Không thể xóa kết quả trúng thưởng: ${error.message}` }, { status: 500 });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
