-- Migration an toàn: tạo đợt khảo sát TVV độc lập, không xóa hoặc sửa dữ liệu cũ.
create table if not exists public.lwv_advisor_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  survey_date date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.lwv_customers
  add column if not exists advisor_campaign_id uuid
  references public.lwv_advisor_campaigns(id);

create index if not exists lwv_customers_advisor_campaign_idx
  on public.lwv_customers (advisor_campaign_id, created_at);

-- Cho phép cùng TVV tham gia các đợt khác nhau, nhưng không đăng ký trùng
-- trong cùng một đợt. Giữ tính duy nhất số điện thoại cho hồ sơ khách hàng thường.
drop index if exists public.lwv_customers_phone_normalized_idx;
create unique index lwv_customers_phone_normalized_idx
  on public.lwv_customers (regexp_replace(phone, '\\s', '', 'g'))
  where event_name is distinct from '__TVV_SURVEY__';

create unique index if not exists lwv_advisor_campaign_phone_unique_idx
  on public.lwv_customers (advisor_campaign_id, regexp_replace(phone, '\\s', '', 'g'))
  where event_name = '__TVV_SURVEY__' and advisor_campaign_id is not null;

alter table public.lwv_advisor_campaigns enable row level security;
-- Không mở policy công khai. API máy chủ sử dụng SUPABASE_SERVICE_ROLE_KEY.

-- Sau khi chạy migration, tạo đợt khảo sát mới bằng cách bỏ comment dòng dưới:
-- insert into public.lwv_advisor_campaigns (name, survey_date)
-- values ('Cam kết kinh doanh TVV – Ngày.....', null)
-- returning id, name, survey_date;
