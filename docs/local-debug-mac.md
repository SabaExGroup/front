# دیباگ لوکال روی Mac (بدون Docker)

## چی لازم داری؟

| سرویس | نصب | اجباری؟ |
|--------|-----|---------|
| PostgreSQL | `brew install postgresql@14` | ✅ |
| Redis | `brew install redis` | ✅ |
| MinIO | `brew install minio/stable/minio` | ✅ (`STORAGE_ENABLED=true`) |
| BullMQ Worker | **نیاز به نصب ندارد** — فقط `npm run start:worker:dev` | ✅ |

Worker یک process Node است، مثل API — جدا نصب نمی‌شود.

---

## یک‌بار setup

```bash
brew services start postgresql@14
brew services start redis
chmod +x scripts/mac-dev-bootstrap.sh
./scripts/mac-dev-bootstrap.sh
```

یا:

```bash
npm run dev:bootstrap
```

---

## `.env` روی Mac

```env
DATABASE_URL=postgresql://YOUR_MAC_USER@localhost:5432/token_platform
REDIS_URL=redis://localhost:6379
NODE_ENV=development
STORAGE_ENABLED=false   # بدون MinIO برای شروع
```

`YOUR_MAC_USER` = خروجی `whoami` (مثلاً `artanzh`) — **نه** `postgres:postgres`.

---

## هر بار دیباگ — دو ترمینال

**ترمینال ۱ — API + cron:**

```bash
npm run start:dev
```

**ترمینال ۲ — BullMQ worker (اجباری):**

```bash
npm run start:worker:dev
```

بدون ترمینال ۲: cycle در `FUNDING` یا `PENDING` گیر می‌کند.


---

## لوگو توکن — URL پایدار (بدون MinIO)

لوگو **همیشه** ذخیره می‌شود — دیگر URL موقت OpenAI در DB نمی‌ماند.

| حالت | URL نهایی |
|------|-----------|
| `STORAGE_ENABLED=false` (پیش‌فرض دیباگ) | `http://localhost:5420/api/v1/assets/logos/{hash}.png` |
| MinIO روشن | `S3_PUBLIC_BASE_URL/logos/...` |

فایل‌ها در `data/logos/` (gitignore) — سرو public بدون API key.

روی **سرور production** حتماً:

```env
APP_PUBLIC_BASE_URL=https://api.YOUR_DOMAIN.com/api/v1
```

تا four.meme / DexScreener بتوانند لوگو را ببینند.

---

## MinIO (اختیاری — لوگو روی S3)

```bash
brew install minio/stable/minio
mkdir -p ~/minio-data
minio server ~/minio-data --address ":9000" --console-address ":9001"
```

Console: http://localhost:9001
