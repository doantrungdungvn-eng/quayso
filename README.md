# Vòng Quay May Mắn — Tri Ân Khách Hàng VIP

Ứng dụng Next.js dành cho sự kiện tri ân khách hàng: đăng ký bằng QR, khảo sát, import Excel, vòng quay 7 giây, nhiều giải thưởng, lưu lịch sử người trúng và xuất Excel.

## Chức năng

- Giao diện vòng quay nhiều màu lấy cảm hứng từ Wheel of Names.
- Quay hiệu ứng 7 giây; lựa chọn người trúng bằng Web Crypto trên client ở bản MVP.
- Mỗi khách hàng chỉ được trúng một lần trong dữ liệu hiện có.
- Nhiều giải thưởng với số lượng từng giải; thêm/tắt giải.
- Form khách hàng: họ tên, số điện thoại, mã KH, TVV mời, đơn vị, khảo sát và đồng ý xử lý dữ liệu.
- QR đăng ký theo URL của ứng dụng.
- Import .xlsx, .xls, .csv; bỏ dòng thiếu tên/số điện thoại và số điện thoại trùng.
- Quản lý khách hàng, lọc/tìm kiếm, loại khỏi/cho phép quay.
- Danh sách người trúng và xuất Excel; báo cáo khảo sát.
- Demo hoạt động với localStorage khi chưa cấu hình Supabase.

## Chạy local

Yêu cầu Node.js 18+.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Mở http://localhost:3000.

## Deploy lên Vercel

1. Tạo repository GitHub và đưa toàn bộ source này lên.
2. Import repository tại Vercel.
3. Trong Project Settings → Environment Variables, thêm:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy. Không cần cấu hình biến môi trường nếu chỉ muốn xem demo local/trình duyệt.

## Supabase — lưu ý bảo mật

1. Tạo project Supabase.
2. Chạy `supabase/schema.sql` trong SQL Editor.
3. Schema bật RLS và **không** cấp quyền ghi/đọc công khai mặc định. Điều này có chủ đích để không làm lộ dữ liệu khách hàng.
4. Trước khi vận hành thật, cần bổ sung Supabase Auth, vai trò quản trị/TVV, các policy RLS tối thiểu, và các API server-side để ghi dữ liệu. Không tạo policy `anon` cho phép đọc toàn bộ số điện thoại/thông tin khách hàng.
5. Đưa logic chọn người thắng về server-side: transaction/RPC hoặc API route dùng service-role key chỉ ở server; khóa lượt quay, kiểm tra khách chưa từng trúng, kiểm tra số lượng giải còn lại, ghi kết quả bất biến vào một transaction. Không để client tự quyết định người thắng cho sự kiện chính thức.
6. Cấu hình quy trình đồng ý xử lý dữ liệu, thời hạn lưu trữ, quyền truy cập và xóa dữ liệu theo chính sách của đơn vị.

## Import Excel

Tệp cần có dòng tiêu đề, tối thiểu:
- `Họ và tên` (hoặc `Họ tên`, `Tên khách hàng`, `full_name`, `name`)
- `Số điện thoại` (hoặc `Điện thoại`, `phone`, `mobile`)

Cột tùy chọn:
- `Mã khách hàng` / `customer_code`
- `TVV mời` / `TVV` / `Tư vấn viên` / `advisor_name`
- `Đơn vị` / `Nhóm` / `agency`

## Trạng thái MVP — đọc trước khi dùng sự kiện thật

Bản source cung cấp luồng UI và chức năng MVP. PIN quản trị hiện lưu ở trình duyệt và chỉ để demo; nó không phải xác thực bảo mật. Khi có Supabase, việc bật biến môi trường không tự động cấu hình quyền truy cập. Hãy hoàn tất Auth/RLS/API phía server, kiểm thử tải và quy trình xử lý dữ liệu trước sự kiện thật. Không dùng dữ liệu khách hàng thật trên demo công khai chưa được bảo vệ.


## Đồng bộ đăng ký từ điện thoại sang website

Bản cập nhật thêm API server-side để ghi đăng ký từ QR vào Supabase và chỉ hiện thông báo **ĐĂNG KÝ THÀNH CÔNG** sau khi lưu thành công.

Thêm biến trên Vercel → Settings → Environment Variables, chọn Production rồi Redeploy:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (có thể giữ lại cho các phần khác)
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, tuyệt đối không đặt tên `NEXT_PUBLIC_*`
- `ADMIN_PIN` — PIN máy chủ dùng để bảo vệ API đồng bộ. Phải trùng chính xác với PIN trong mục **Cài đặt → PIN quản trị trên thiết bị**. Nên đặt một mã riêng, không sử dụng PIN mặc định.

Sau khi triển khai, khách quét QR đăng ký sẽ ghi vào cơ sở dữ liệu chung. Trên thiết bị quản trị, website tự tải dữ liệu từ Supabase khi mở các trang quản trị; có thể vào mục Cài đặt và bấm **Đồng bộ từ Supabase** để tải lại thủ công. Nếu đồng bộ báo 401, hãy kiểm tra `ADMIN_PIN` trên Vercel có trùng PIN đã lưu trong mục Cài đặt trên trình duyệt quản trị hay không. Không chia sẻ service-role key. Đây là bản MVP; trước sự kiện chính thức nên bổ sung xác thực quản trị đầy đủ và giới hạn tần suất gửi đăng ký.


## Tách trang quản trị và QR đăng ký theo ngày/giờ sự kiện

- Trang quản trị: mở `https://YOUR-DOMAIN/?page=admin` (hoặc domain gốc). Trang này có menu quản trị, cấu hình sự kiện và tạo QR.
- Trang đăng ký công khai: dùng link QR tạo trong **Cài đặt → QR riêng cho sự kiện**. Trang công khai chỉ hiển thị form đăng ký, không hiển thị menu quản trị hay bảng điều khiển.
- QR chứa tên sự kiện, ngày và giờ đã cài đặt; form hiển thị thông tin này và gửi metadata cùng đăng ký.

### Cập nhật database đã tồn tại

Vì bảng `lwv_customers` có thể đã được tạo trước khi thêm thông tin sự kiện, hãy mở Supabase → SQL Editor và chạy:

```sql
alter table public.lwv_customers add column if not exists event_name text;
alter table public.lwv_customers add column if not exists event_date date;
alter table public.lwv_customers add column if not exists event_time text;
```

Sau đó đẩy mã nguồn lên GitHub và chờ Vercel deploy thành công. Cấu hình ngày/giờ trên trang quản trị được mã hóa vào URL QR; mỗi link QR có thể dùng độc lập cho sự kiện tương ứng.
