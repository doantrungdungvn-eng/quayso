# Khảo sát TVV theo từng đợt

## 1. Sao lưu và migration

1. Sao lưu Supabase trước khi sửa.
2. Vào Supabase → SQL Editor, chạy toàn bộ `supabase/advisor-campaigns-migration.sql`.
3. Tạo một đợt khảo sát mới:

```sql
insert into public.lwv_advisor_campaigns (name, survey_date)
values ('Cam kết kinh doanh TVV – Ngày.....', null)
returning id, name, survey_date;
```

Lưu `id` UUID trả về. Không cần gán mã đợt cho các dòng cũ; dữ liệu cũ vẫn được giữ nguyên.

## 2. Cấu hình link và QR riêng

1. Deploy phiên bản này lên Vercel.
2. Đăng nhập trang quản trị, mở tab **Tư vấn viên**.
3. Dán UUID vào ô **ID đợt khảo sát TVV**.
4. QR và link trên màn hình sẽ mang dạng:
   `https://quayso-three.vercel.app/advisor-survey?campaign=UUID`
5. Chọn **Sao chép link** hoặc **Mở khảo sát TVV**.

Trang khảo sát sẽ kiểm tra mã đợt qua API. Đợt không tồn tại hoặc đã đóng sẽ không cho gửi khảo sát.

## 3. Cô lập dữ liệu

Khi ID đợt được nhập trong tab Tư vấn viên, bảng TVV, Top 5/Top 10, và vòng quay TVV sử dụng hồ sơ thuộc đợt đó. Xóa ô ID để xem lại các hồ sơ TVV cũ và các đợt chưa lọc.

## 4. Bảo mật

- Không đưa `SUPABASE_SERVICE_ROLE_KEY` vào mã client hoặc chia sẻ công khai.
- Bảng `lwv_advisor_campaigns` bật RLS và không có policy ghi công khai.
- API dùng khóa máy chủ từ biến môi trường Vercel.
- Migration không xóa bảng hoặc dữ liệu khách hàng/kết quả quay hiện có.
