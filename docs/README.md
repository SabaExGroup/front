# API Documentation

مستندات API برای تیم فرانت و یکپارچه‌سازی پنل مدیریت.

| سند | توضیح |
|-----|--------|
| [Wallet Overview — Frontend Guide](./wallet-overview.md) | لیست تمام ولت‌های سیستم، سینک موجودی، و نمایش جمع USD |
| [Market Making — Frontend Guide](./market-making-frontend.md) | شروع/توقف/مانیتورینگ market making روی یک سیکل |
| [Emergency · Treasury · Drain — Frontend Guide](./frontend-emergency-treasury.md) | ترمز اضطراری، خالی‌کردن ولت‌ها، جمع‌آوری سود |
| [Manual Launchpad (CUSTOM_RAYDIUM) — Frontend Guide](./manual-launchpad-frontend.md) | لانچ‌پد کاستوم منوال: ولت لیکوئیدیتی، لاک/آنلاک، مارکت‌میکینگ روی Raydium، ترمز دستی |
| [Manual Sell / Liquidity Unlock — Frontend Guide](./manual-sell-liquidity-frontend.md) | سه سیکل دستی درصدی: فروش مارکت ولت‌ها، فروش ولت اونر، آنلاک درصدی لیکوئیدیتی (`/manual-ops/*`) |
| [Admin Panel — Full Spec](./admin-panel-spec.md) | نقشه کامل صفحات پنل ادمین → endpoint |

## Swagger

در محیط dev/staging:

- **OpenAPI UI:** `{BASE_URL}/docs`
- **Base path API:** `{BASE_URL}/api/v1`

مثال local: `http://localhost:5420/docs`

## احراز هویت

تمام اندپوینت‌های زیر (به‌جز health عمومی) نیاز به هدر زیر دارند:

```http
X-API-Key: <API_KEY>
```
