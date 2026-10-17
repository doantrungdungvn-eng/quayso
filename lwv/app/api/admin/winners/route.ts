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

  let body: { prizeId?: string; winner?: { id?: string; customer_id?: string; full_name?: string; phone?: string; customer_code?: string; advisor_name?: string; prize_name?: string; won_at?: string } };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Dữ liệu kết quả không hợp lệ." }, { status: 400 }); }
  const prizeId = typeof body.prizeId === "string" ? body.prizeId.trim() : "";
  const w = body.winner;
  if (!prizeId || !w?.id || !w.customer_id || !w.full_name || !w.phone || !w.prize_name) return NextResponse.json({ error: "Thiếu thông tin giải thưởng hoặc khách hàng trúng thưởng." }, { status: 400 });

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: existingWinner, error: existingError } = await supabase.from("lwv_winners").select("id").eq("customer_id", w.customer_id).maybeSingle();
  if (existingError) return NextResponse.json({ error: `Không kiểm tra được lịch sử trúng thưởng: ${existingError.message}` }, { status: 500 });
  if (existingWinner) return NextResponse.json({ error: "Khách hàng này đã có kết quả trúng thưởng. Hãy đồng bộ dữ liệu trước khi quay tiếp." }, { status: 409 });

  const { data: prize, error: prizeError } = await supabase.from("lwv_prizes").select("id,name,quantity,won,active").eq("id", prizeId).single();
  if (prizeError || !prize) return NextResponse.json({ error: "Không tìm thấy giải thưởng trên Supabase. Hãy đồng bộ cơ cấu giải trước khi quay." }, { status: 404 });
  if (!prize.active || Number(prize.won) >= Number(prize.quantity)) return NextResponse.json({ error: "Giải thưởng đã hết số lượng. Hãy đồng bộ và chọn giải còn lượt." }, { status: 409 });

  const winnerRow = { id: w.id, customer_id: w.customer_id, full_name: w.full_name, phone: w.phone, customer_code: w.customer_code || "", advisor_name: w.advisor_name || "", prize_name: prize.name, won_at: w.won_at || new Date().toISOString() };
  const { error: insertError } = await supabase.from("lwv_winners").insert(winnerRow);
  if (insertError) return NextResponse.json({ error: `Không thể lưu người trúng thưởng: ${insertError.message}` }, { status: 500 });
  const { data: updatedPrize, error: updateError } = await supabase.from("lwv_prizes").update({ won: Number(prize.won) + 1 }).eq("id", prizeId).select("id,name,quantity,won,active").single();
  if (updateError || !updatedPrize) return NextResponse.json({ error: "Đã ghi người trúng nhưng chưa cập nhật được số lượng giải. Vui lòng kiểm tra Supabase trước lượt quay tiếp theo." }, { status: 500 });
  return NextResponse.json({ ok: true, winner: winnerRow, prize: updatedPrize }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
