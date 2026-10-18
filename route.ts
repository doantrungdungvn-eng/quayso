import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  // Request the deleted row back so we can distinguish a real deletion from an ID mismatch.
  const { data, error } = await supabase.from("lwv_prizes").delete().eq("id", prizeId).select("id,name");
  if (error) {
    return NextResponse.json({ error: `Không thể xóa giải thưởng khỏi Supabase: ${error.message}` }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Không tìm thấy giải này trong Supabase. Hãy đồng bộ lại danh sách trước khi xóa." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, deleted: data[0] }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}

export async function POST(request: Request) {
  const expectedPin = process.env.ADMIN_PIN;
  const suppliedPin = request.headers.get("x-admin-pin");
  if (!expectedPin || !suppliedPin || suppliedPin !== expectedPin) {
    return NextResponse.json({ error: "Không được phép lưu giải thưởng. Hãy kiểm tra PIN quản trị trên Vercel." }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Máy chủ chưa cấu hình Supabase service key." }, { status: 503 });
  }

  let body: { prizes?: Array<{ id?: string; name?: string; quantity?: number; won?: number; active?: boolean }> };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Dữ liệu yêu cầu không hợp lệ." }, { status: 400 });
  }
  if (!Array.isArray(body.prizes)) {
    return NextResponse.json({ error: "Thiếu danh sách giải thưởng." }, { status: 400 });
  }
  const prizes = body.prizes.map((p) => ({
    id: typeof p.id === "string" ? p.id.trim() : "",
    name: typeof p.name === "string" ? p.name.trim() : "",
    quantity: Number(p.quantity),
    won: Number(p.won ?? 0),
    active: p.active !== false,
  }));
  if (prizes.some((p) => !p.id || !p.name || !Number.isInteger(p.quantity) || p.quantity < 1 || !Number.isInteger(p.won) || p.won < 0 || p.quantity < p.won)) {
    return NextResponse.json({ error: "Tên giải hoặc số lượng không hợp lệ. Số lượng không được thấp hơn số giải đã trao." }, { status: 400 });
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  if (prizes.length) {
    const { error } = await supabase.from("lwv_prizes").upsert(prizes, { onConflict: "id" });
    if (error) {
      return NextResponse.json({ error: `Không thể lưu giải thưởng vào Supabase: ${error.message}` }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true, saved: prizes.length }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
