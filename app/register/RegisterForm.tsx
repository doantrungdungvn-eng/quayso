"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, QrCode } from "lucide-react";

type Fields = { full_name: string; phone: string; customer_code: string; advisor_name: string; agency: string; survey_rating: string; survey_interest: string; survey_feedback: string; consent: boolean };
const initial: Fields = { full_name: "", phone: "", customer_code: "", advisor_name: "", agency: "", survey_rating: "5", survey_interest: "Giải pháp sức khỏe", survey_feedback: "", consent: false };

export default function RegisterPage() {
  const params = useSearchParams();
  const eventName = params.get("eventName") || "Sự kiện khách hàng";
  const eventDate = params.get("eventDate") || "";
  const eventTime = params.get("eventTime") || "";
  const [form, setForm] = useState<Fields>(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const update = (key: keyof Fields, value: string | boolean) => setForm(old => ({ ...old, [key]: value }));

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    if (!form.consent) { setMessage({ text: "Vui lòng xác nhận đồng ý trước khi đăng ký.", error: true }); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, survey_rating: Number(form.survey_rating), event_name: eventName, event_date: eventDate, event_time: eventTime, id: crypto.randomUUID() })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Đăng ký chưa thành công. Vui lòng thử lại.");
      setForm(initial);
      setMessage({ text: "Đăng ký thành công! Thông tin của anh/chị đã được lưu.", error: false });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Không kết nối được máy chủ. Vui lòng thử lại.", error: true });
    } finally { setBusy(false); }
  }

  return <main className="app-shell">
    <header className="topbar"><div className="brand"><div className="brand-mark">✦</div><div><h1>LUCKY WHEEL <span style={{ color: "#e9c76d" }}>VIP</span></h1><p>Đăng ký tham gia sự kiện</p></div></div></header>
    <div className="hero"><div><div className="eyebrow">Customer appreciation event</div><h2>Đăng ký tham gia</h2><p>Vui lòng điền thông tin và hoàn thành khảo sát.</p></div></div>
    <div className="notice success" style={{ marginBottom: 16 }}><b>{eventName}</b>{eventDate && <> · Ngày {new Date(`${eventDate}T00:00:00`).toLocaleDateString("vi-VN")}</>}{eventTime && <> · {eventTime}</>}</div>
    {message && <div className={`notice ${message.error ? "error" : "success"}`} style={{ marginBottom: 16 }} role="status">{message.text}</div>}
    <section className="panel"><div className="panel-head"><div><h3><QrCode size={17} style={{ display: "inline", verticalAlign: "-3px", marginRight: 7 }} />Thông tin khách hàng</h3><p>Thông tin có dấu * là bắt buộc.</p></div></div>
      <form onSubmit={submit} className="field-grid">
        <div className="field full"><label>Họ và tên *</label><input value={form.full_name} onChange={e => update("full_name", e.target.value)} placeholder="Nguyễn Văn A" autoComplete="name" required /></div>
        <div className="field"><label>Số điện thoại *</label><input value={form.phone} onChange={e => update("phone", e.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="09xxxxxxxx" required /></div>
        <div className="field"><label>Mã khách hàng</label><input value={form.customer_code} onChange={e => update("customer_code", e.target.value)} placeholder="Nếu có" /></div>
        <div className="field"><label>TVV mời khách</label><input value={form.advisor_name} onChange={e => update("advisor_name", e.target.value)} placeholder="Tên tư vấn viên" /></div>
        <div className="field"><label>Đơn vị / nhóm</label><input value={form.agency} onChange={e => update("agency", e.target.value)} placeholder="GA / nhóm kinh doanh" /></div>
        <div className="field full"><label>Mức độ hài lòng với chương trình</label><select value={form.survey_rating} onChange={e => update("survey_rating", e.target.value)}><option value="5">5 - Rất hài lòng</option><option value="4">4 - Hài lòng</option><option value="3">3 - Bình thường</option><option value="2">2 - Chưa hài lòng</option><option value="1">1 - Không hài lòng</option></select></div>
        <div className="field full"><label>Anh/chị quan tâm giải pháp nào?</label><select value={form.survey_interest} onChange={e => update("survey_interest", e.target.value)}><option>Giải pháp sức khỏe</option><option>Bảo vệ tài chính gia đình</option><option>Tích lũy dài hạn</option><option>Đầu tư và quỹ</option><option>Chưa có nhu cầu</option><option>Khác</option></select></div>
        <div className="field full"><label>Ý kiến góp ý (không bắt buộc)</label><textarea value={form.survey_feedback} onChange={e => update("survey_feedback", e.target.value)} placeholder="Chia sẻ ý kiến của anh/chị..." /></div>
        <div className="field full"><label className="checkbox-row"><input type="checkbox" checked={form.consent} onChange={e => update("consent", e.target.checked)} /><span>Tôi xác nhận thông tin đã cung cấp là chính xác và đồng ý để ban tổ chức sử dụng thông tin cho việc tổ chức sự kiện, khảo sát và quay thưởng theo thông báo về quyền riêng tư.</span></label></div>
        <div className="field full"><button className="primary-btn full-btn" type="submit" disabled={busy}>{busy ? "Đang gửi đăng ký…" : <><CheckCircle2 size={16} /> Gửi đăng ký</>}</button></div>
      </form>
    </section>
    <footer className="footer">Dữ liệu chỉ được sử dụng cho mục đích tổ chức sự kiện và theo thông báo quyền riêng tư.</footer>
  </main>;
}
