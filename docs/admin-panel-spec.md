# مشخصات پنل ادمین — راهنمای Frontend (بر اساس API زنده)

> **نسخه:** 2.0 · هم‌گام با `GET http://localhost:5420/docs-json`  
> **مخاطب:** تیم Frontend  
> **Base URL:** `http://localhost:5420/api/v1`  
> **Swagger UI:** `http://localhost:5420/docs`  
> **OpenAPI JSON:** `http://localhost:5420/docs-json`

این سند **مرجع عملیاتی** است: هر صفحهٔ پنل دقیقاً کدام endpoint را با چه body/query صدا بزند، چه response بگیرد، و چه خطایی نشان دهد.

> **Emergency · Treasury · Drain (ژوئن ۲۰۲۶):** راهنمای عمیق و به‌روز ولت‌های funding/withdrawal، `convertTo`، polling و migration checklist فرانت →  
> **[`docs/frontend-emergency-treasury.md`](./frontend-emergency-treasury.md)**

---

## ۱. شروع سریع

### ۱.۱ احراز هویت

لاگین username/password **وجود ندارد**. همهٔ routeها به‌جز سه مورد زیر نیاز به header دارند:

```http
X-API-Key: <مقدار API_KEY روی سرور>
Content-Type: application/json
```

| Route | نیاز به API Key |
|-------|-----------------|
| `GET /health` | خیر |
| `GET /integrations/health` | خیر |
| `GET /integrations/rpc/health` | خیر |
| `GET /assets/logos/{filename}` | خیر |
| **بقیه ۴۲ endpoint** | **بله** |

**MVP پیشنهادی:** صفحه `/login` → کاربر API Key را paste می‌کند → در `sessionStorage` → تست با `GET /main-fee-wallet` → اگر 200 بود redirect به Dashboard.

### ۱.۲ قالب خطا (همهٔ 4xx/5xx)

```json
{
  "statusCode": 401,
  "message": {
    "message": "Invalid API key",
    "error": "Unauthorized",
    "statusCode": 401
  },
  "timestamp": "2026-06-23T12:00:00.000Z"
}
```

Validation (400): `message.message` می‌تواند **آرایهٔ string** باشد.

| Code | UI پیشنهادی |
|------|-------------|
| 401 | پاک کردن session → `/login` |
| 400 | toast + highlight فیلد |
| 404 | «یافت نشد» |
| 409 | toast «عملیات در جریان است / وضعیت نامعتبر» |
| 500 | toast + لاگ |

### ۱.۳ الگوی fetch

```typescript
const API_BASE = sessionStorage.getItem('apiBase') ?? 'http://localhost:5420/api/v1';
const API_KEY = sessionStorage.getItem('apiKey') ?? '';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      ...init?.headers,
    },
  });
  if (res.status === 401) {
    sessionStorage.clear();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw err;
  }
  return res.json();
}
```

---

## ۲. Enumها (ثابت در UI)

### CycleStatus — فیلتر لیست + badge

```
PENDING → TREND_GENERATION → LAUNCHPAD_SELECTION → WALLET_GENERATION →
SECURITY_CHECK → FUNDING → TOKEN_LAUNCH → MARKET_MAKING → MONITORING →
COMPLETED | FAILED | ABORTED
```

**Terminal (polling متوقف):** `COMPLETED`, `FAILED`, `ABORTED`

### Network

`SOLANA` | `BSC`

### Launchpad

`PUMP_FUN` | `FOUR_MEME` | `LETS_BONK` | `CUSTOM_RAYDIUM`

> **پیش‌فرض سیستم `CUSTOM_RAYDIUM` است.** وقتی سیکلی بدون `forceLaunchpad` (در
> `POST /core-trigger/cycles`) یا `launchpad` (در `POST /token-factory/launch`) استارت می‌شود —
> شامل سیکل‌های زمان‌بندی‌شده (cron) — سیستم از `strategy.defaultLaunchpad` استفاده می‌کند که
> مقدار پیش‌فرض آن `"CUSTOM_RAYDIUM"` است. این را می‌توان از تنظیمات (`PATCH /settings` با
> `{ "strategy": { "defaultLaunchpad": ... } }`) به یک لانچ‌پد مشخص دیگر (`PUMP_FUN`,
> `LETS_BONK`, `FOUR_MEME`) تغییر داد، یا با مقدار `"AUTO"` به حالت انتخاب خودکار قبلی (بر اساس
> امتیازدهی GMGN/لیکوئیدیتی، `GET /token-factory/launchpads/best`) برگرداند. `forceLaunchpad` در
> هر درخواست، همیشه بر تنظیم پیش‌فرض اولویت دارد. اگر پیش‌فرض تنظیم‌شده با شبکه‌ی آن سیکل سازگار
> نباشد (مثلاً `CUSTOM_RAYDIUM` که فقط روی سولانا کار می‌کند، برای یک سیکل BSC)، سیستم بی‌صدا به
> انتخاب خودکار سوییچ می‌کند. جزئیات کامل: [`manual-launchpad-frontend.md`](./manual-launchpad-frontend.md).

### WalletType

`TOKEN_OWNER` | `MARKET` | `LIQUIDITY` (فقط سیکل‌های `CUSTOM_RAYDIUM` — نگه‌دارنده‌ی custodial LP)

### EmergencyBrakeScope

`GLOBAL` | `CYCLE` (با `cycleId`)

### Treasury lifecycle phase

`DRAINING` | `WAITING_DEPOSIT` | `REARMING` | `READY` | `FAILED`

### Job status (عمومی)

`QUEUED` | `RUNNING` | `COMPLETED` | `FAILED` (و گاهی `PARTIAL`, `SKIPPED`, …)

---

## ۳. نقشه صفحات → Endpoint

| Route UI | صفحه | Endpointهای اصلی |
|----------|------|------------------|
| `/login` | ورود API Key | `GET /main-fee-wallet` (تست) |
| `/` | Dashboard | health، integrations، halt، main-fee، native-prices، cycles |
| `/cycles` | لیست چرخه | `GET /core-trigger/cycles` |
| `/cycles/:id` | جزئیات چرخه | cycle detail، resume، retry، abort، profit، wallets |
| `/settings` | تنظیمات | `GET/PATCH /settings`، proxy test، telegram test |
| `/emergency` | ترمز اضطراری | brake، halt، resume، poll job |
| `/treasury` | خزانه | drain، rearm، lifecycle، consolidate |

---

## ۴. فلوهای ادمین (sequence)

### ۴.۱ ورود

```
کاربر → /login → paste API Key
  → GET /main-fee-wallet (با header)
  → 200: sessionStorage + redirect /
  → 401: «Invalid API key»
```

### ۴.۲ شروع چرخه دستی (Dashboard یا Cycles)

```
کلیک Start Cycle → confirm
  → POST /core-trigger/cycles  { "dryRun": false, "ignorePeakSchedule": false }
  → 200 + { id, status, network, launchpad, startedAt }
  → navigate /cycles/:id
  → poll GET /core-trigger/cycles/:id هر 5s تا terminal
```

**شرط:** `GET /emergency/halt` → `halted !== true` (وگرنه دکمه disabled + بنر)

### ۴.۳ چرخه FAILED — Retry / Resume

```
GET /core-trigger/cycles/:id/resume
  → { canResume, suggestedResumeStep, failedAtStep, status }

اگر canResume:
  POST /core-trigger/cycles/:id/retry
  { "mode": "resume", "force": false }
  → poll detail تا خارج از FAILED
```

### ۴.۴ Emergency GLOBAL

```
confirm + reason (اجباری)
  → POST /emergency/brake
  { "scope": "GLOBAL", "convertTo": "NATIVE", "fullDrain": false, "reason": "..." }
  → jobId
  → poll GET /emergency/brake/:jobId هر 3s
  → GET /emergency/halt → halted: true
```

**مقصد sweep:** `nativeWithdrawalSolanaAddress` / `nativeWithdrawalBscAddress` — **نه** funding wallet.

| `convertTo` | نتیجه |
|-------------|--------|
| `NATIVE` | SOL/BNB روی ولت برداشت |
| `USDC` | Jupiter + ChangeNOW (نیاز کلیدهای withdrawal) |

`fullDrain: true` + `GLOBAL` → پاسخ `drainJobId`؛ poll با `GET /treasury/lifecycle/{drainJobId}`.

### ۴.۵ Resume بعد از halt

```
POST /emergency/resume  { "jobId": "<آخرین brake jobId>" }
  → { status: "RESUMED", message }
  → GET /emergency/halt → halted: false
```

### ۴.۶ Treasury lifecycle یک‌کلیک

```
POST /treasury/lifecycle/run  { drain, waitForDeposit, rearm, startCycleAfterRearm }
  → { jobId, phase: "DRAINING", status: "QUEUED" }
  → poll GET /treasury/lifecycle/:jobId هر 5s
```

Drain تنها (`POST /treasury/drain`) همان `jobId` و همان endpoint poll را دارد.

پیش‌فرض `drain.convertTo` از `settings.treasury.lifecycle.defaultDrainConvertTo` = **`NATIVE`**.

جزئیات کامل: [`frontend-emergency-treasury.md`](./frontend-emergency-treasury.md).

---

## ۵. مرجع Endpoint — جزءبه‌جزء

هر بخش: **کجا در UI** · **درخواست** · **پاسخ** · **خطاها** · **Polling**

---

### ۵.۱ Health & Integrations (عمومی + Dashboard)

#### `GET /health` — بدون API Key

| | |
|---|---|
| **UI** | Dashboard — کارت «System» |
| **Poll** | 30s |

```json
// 200
{
  "status": "ok",
  "checkedAt": "2026-06-23T12:00:00.000Z",
  "postgres": "up",
  "redis": "up",
  "bullmq": "up",
  "objectStorage": "disabled",
  "processRole": "api"
}
```

`status`: `ok` \| `degraded` — هر dependency `up` \| `down`

---

#### `GET /integrations/health` — بدون API Key

| | |
|---|---|
| **UI** | Dashboard — جدول provider |
| **Poll** | 60s |

```json
{
  "status": "ok",
  "checkedAt": "...",
  "configValid": true,
  "providers": {
    "gmgn": { "status": "up", "latencyMs": 210 },
    "dexscreener": { "status": "up", "latencyMs": 95 },
    "solanaRpc": { "status": "up", "latencyMs": 45 }
  }
}
```

---

#### `GET /integrations/rpc/health` — بدون API Key

| | |
|---|---|
| **UI** | Dashboard — RPC solana / bsc / ethereum |

```json
{
  "status": "ok",
  "checkedAt": "...",
  "solana": { "provider": "quicknode", "status": "up", "latencyMs": 52, "slot": 312456789 },
  "bsc": { "status": "up", "latencyMs": 48, "blockNumber": 42156789, "chainId": 56 },
  "ethereum": { "status": "up", "latencyMs": 55, "blockNumber": 19876543, "chainId": 1 }
}
```

---

#### `GET /integrations/native-prices` — نیاز API Key

| | |
|---|---|
| **UI** | Dashboard — قیمت SOL/BNB |
| **Poll** | 60s |

```json
{
  "solUsd": 178.42,
  "bnbUsd": 612.15,
  "sources": { "sol": "gmgn", "bnb": "changenow" },
  "fetchedAt": "...",
  "cached": true
}
```

#### `POST /integrations/native-prices/refresh`

Invalidate cache — معمولاً دکمه «Refresh prices» در Dashboard (اختیاری).

---

### ۵.۲ Emergency & Halt (Global banner + صفحه Emergency)

#### `GET /emergency/halt`

| | |
|---|---|
| **UI** | **Global banner** (همه صفحات) + صفحه Emergency |
| **Poll** | **10s** |

```json
{
  "halted": true,
  "halt": { "reason": "GLOBAL full drain", "since": "2026-06-23T12:00:00.000Z" },
  "emergencyLock": "brake-7f3a2b1c"
}
```

اگر `halted: true` → بنر قرمز، disable «Start Cycle»، نشان دادن دکمه Resume.

---

#### `POST /emergency/brake`

| | |
|---|---|
| **UI** | Emergency — دکمه ترمز |
| **Body** | `ManualBrakeDto` |
| **خطا** | 409 brake در جریان · 404 بدون cycleId برای scope CYCLE |

```json
{
  "scope": "GLOBAL",
  "cycleId": "uuid-only-if-CYCLE",
  "convertTo": "NATIVE",
  "fullDrain": false,
  "reason": "operator panic — توضیح اجباری"
}
```

`convertTo`: `NATIVE` \| `USDC` · `convertToUsdc` deprecated

```json
// 200 — SELL_SWEEP
{
  "jobId": "emergency_1719312345_1234",
  "status": "QUEUED",
  "mode": "SELL_SWEEP",
  "convertTo": "NATIVE",
  "walletsAffected": 150,
  "message": "Emergency brake: sell all tokens → sweep SOL/BNB to native withdrawal wallets"
}
```

```json
// 200 — FULL_DRAIN (fullDrain:true + GLOBAL)
{
  "jobId": "emergency_...",
  "drainJobId": "drain_...",
  "status": "QUEUED",
  "mode": "FULL_DRAIN",
  "systemHalted": true
}
```

---

#### `GET /emergency/brake/{jobId}`

| | |
|---|---|
| **UI** | Emergency — progress bar |
| **Poll** | 3s تا terminal |

```json
{
  "jobId": "brake-7f3a2b1c",
  "status": "RUNNING",
  "progress": { "walletsProcessed": 75, "walletsSold": 73, "walletsFailed": 2 },
  "usdRecovered": 1250.5,
  "durationMs": 45000
}
```

`status`: `QUEUED` \| `RUNNING` \| `COMPLETED` \| `PARTIAL` \| `FAILED` \| `DRAINED_HALTED`

---

#### `POST /emergency/resume`

| | |
|---|---|
| **UI** | Emergency — فقط وقتی `halted: true` |
| **شرط** | `jobId` از آخرین brake |

```json
{ "jobId": "brake-7f3a2b1c" }
```

```json
// 200
{ "jobId": "brake-7f3a2b1c", "status": "RESUMED", "message": "System halt cleared" }
```

خطا 409: نتوان resume کرد.

---

### ۵.۳ Main Fee Wallet (Dashboard + Login test)

#### `GET /main-fee-wallet`

| | |
|---|---|
| **UI** | Dashboard · **تست اتصال در /login** · کارت‌های Funding / Withdrawal |
| **Poll** | 30s |

```json
{
  "fundingAddress": "0x742d...",
  "ethAddress": "0x742d...",
  "bscAddress": "0x742d...",
  "nativeWithdrawalSolanaAddress": "EDJS...",
  "nativeWithdrawalBscAddress": "0xdd6B...",
  "solanaAddress": "EDJS...",
  "balanceSol": "12.45",
  "balanceBnb": "0.85",
  "balanceUsdc": "1500.00",
  "balanceEth": "0.85",
  "fundingTotalUsd": 1585.7,
  "withdrawalTotalUsd": 2135.8,
  "totalUsd": 1585.7,
  "lowBalanceThresholdUsd": 500,
  "isLowBalance": false,
  "isReadyForRearm": true,
  "minRearmBalanceUsd": 5000,
  "balancesRefreshedAt": "..."
}
```

| فیلد | UI label پیشنهادی |
|------|-------------------|
| `fundingTotalUsd` / `totalUsd` | Funding (USDC+ETH Ethereum) — rearm |
| `withdrawalTotalUsd` | Profit / withdrawal (SOL+BNB) |
| `bscAddress` | Funding EVM — **نه** آدرس برداشت BSC |
| `nativeWithdrawalBscAddress` | آدرس برداشت سود BSC |

---

#### `POST /main-fee-wallet/fund` — HTTP **202**

| | |
|---|---|
| **UI** | Cycle detail — funding دستی (پیشرفته) |
| **Body** | `FundWalletsDto` |

```json
{
  "cycleId": "uuid",
  "walletIds": ["uuid"],
  "sourceAsset": "USDC",
  "targetNetwork": "SOLANA",
  "amountPerWalletUsd": 0.1
}
```

```json
// 202
{
  "jobId": "fund-9c4e2a1b",
  "status": "QUEUED",
  "walletCount": 150,
  "pollIntervalMs": 3000,
  "pollTimeoutMs": 600000,
  "fundingConcurrency": 5
}
```

---

### ۵.۴ Core Trigger — Cycles (قلب پنل)

#### `GET /core-trigger/cycles`

| | |
|---|---|
| **UI** | `/cycles` · Dashboard (limit=5) |
| **Query** | `page` (default 1) · `limit` (1–200, default 50) · `status` (CycleStatus) |

```
GET /core-trigger/cycles?page=1&limit=50&status=MARKET_MAKING
```

```json
{
  "data": [
    {
      "id": "uuid",
      "status": "MARKET_MAKING",
      "network": "SOLANA",
      "launchpad": "PUMP_FUN",
      "startedAt": "2026-06-23T12:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 50
}
```

---

#### `POST /core-trigger/cycles`

| | |
|---|---|
| **UI** | Dashboard / Cycles — Start |
| **Body** | `StartCycleDto` |
| **خطا** | 409 peak schedule / system halted |

```json
{
  "network": "SOLANA",
  "forceLaunchpad": "PUMP_FUN",
  "dryRun": false,
  "ignorePeakSchedule": false
}
```

همه فیلدها optional. Response همان `CycleResponseDto`.

---

#### `GET /core-trigger/cycles/{cycleId}`

| | |
|---|---|
| **UI** | `/cycles/:id` — Overview + timeline |
| **Poll** | 5s تا terminal |

```json
{
  "id": "uuid",
  "status": "MARKET_MAKING",
  "network": "SOLANA",
  "launchpad": "PUMP_FUN",
  "startedAt": "...",
  "tokenId": "uuid",
  "trendPackageId": "uuid",
  "marketSessionId": "uuid",
  "token": { "address": "...", "name": "...", "symbol": "..." },
  "trendPackage": { "name": "...", "logoUrl": "...", "trendTopic": "..." },
  "marketSession": { "status": "RUNNING", "tradesExecuted": 1250 },
  "cycleLogs": [
    { "step": "TOKEN_LAUNCH", "message": "Token launched", "at": "..." }
  ]
}
```

`token` / `trendPackage` / `marketSession` ممکن است null باشند (مراحل اول).

---

#### `POST /core-trigger/cycles/{cycleId}/abort`

| | |
|---|---|
| **UI** | Cycle detail — دکمه Abort (وقتی running) |
| **Body** | ندارد |
| **خطا** | 404 |

---

#### `GET /core-trigger/cycles/{cycleId}/resume`

| | |
|---|---|
| **UI** | Cycle detail — قبل از Retry (FAILED/ABORTED) |

```json
{
  "cycleId": "uuid",
  "status": "FAILED",
  "failedAtStep": "TOKEN_LAUNCH",
  "suggestedResumeStep": "TOKEN_LAUNCH",
  "canResume": true
}
```

---

#### `POST /core-trigger/cycles/{cycleId}/retry`

| | |
|---|---|
| **UI** | Cycle detail — Retry / Resume |
| **Body** | `RetryCycleDto` |
| **خطا** | 409 وضعیت نامعتبر |

```json
{
  "force": false,
  "mode": "resume",
  "fromStep": "TOKEN_LAUNCH",
  "regenerateTrend": false,
  "dryRun": false
}
```

`mode`: `resume` (پیش‌فرض) \| `restart`

```json
// 200
{
  "id": "uuid",
  "status": "FUNDING",
  "mode": "resume",
  "resumeFromStep": "TOKEN_LAUNCH",
  "failedAtStep": "TOKEN_LAUNCH",
  "regeneratedTrend": false
}
```

---

### ۵.۵ Wallets (Cycle detail — تب Wallets)

#### `GET /wallets`

| Query | `page` · `limit` · `cycleId` · `network` · `type` (`TOKEN_OWNER` \| `MARKET`) |

```json
{
  "data": [
    {
      "id": "uuid",
      "address": "7xKX...",
      "network": "SOLANA",
      "type": "MARKET",
      "balanceNative": "0.0523",
      "balanceUsd": 9.32,
      "isActive": true
    }
  ],
  "total": 150
}
```

**نکته:** response شامل `page`/`limit` نیست — فقط `total`.

---

#### `POST /wallets` — تولید دستی

```json
{ "network": "SOLANA", "type": "MARKET", "count": 10, "cycleId": "uuid" }
```

---

#### `GET /wallets/{walletId}` · `GET /wallets/{walletId}/balance`

Detail + balance تازه RPC — برای ردیف expand در جدول wallets.

---

### ۵.۶ Trend Finder (اختیاری — debug)

| Method | Path | UI |
|--------|------|-----|
| POST | `/trend-finder/generate` | Settings/debug — پیش‌نمایش trend |
| POST | `/trend-finder/regenerate/{cycleId}` | Cycle detail — regenerate trend |

```json
// generate body
{ "network": "SOLANA", "style": "viral", "cycleId": "uuid-optional" }
```

---

### ۵.۷ Token Factory & Market (Cycle detail — اکشن‌های پیشرفته)

| Method | Path | UI |
|--------|------|-----|
| GET | `/token-factory/launchpads/best?network=SOLANA` | قبل از launch — recommendation |
| POST | `/token-factory/launch` | `{ "cycleId", "launchpad?", "dryRun?" }` |
| POST | `/market-generator/start` | `{ "cycleId", "tokenId" }` |
| GET | `/market-generator/sessions/{sessionId}` | poll market metrics |
| POST | `/market-generator/sessions/{sessionId}/stop` | Stop market making |

**توجه:** در flow عادی orchestrator خودش این مراحل را اجرا می‌کند؛ دکمه‌ها برای ops دستی/debug.

---

### ۵.۸ Token Info · Liquidity · Security (Cycle detail — لینک تحلیل)

| Method | Path | Query |
|--------|------|-------|
| GET | `/token-info/{address}` | `network` (default SOLANA) |
| GET | `/liquidity/{address}` | `network`, `launchpad?` |
| GET | `/security/check` | `network`, `address` |
| POST | `/security/check` | body `{ network, address }` |

```json
// SecurityReportResponseDto
{
  "score": 72,
  "isSafe": true,
  "risks": [{ "code": "...", "severity": "medium", "description": "..." }],
  "provider": "gmgn",
  "checkedAt": "..."
}
```

---

### ۵.۹ Profit Extractor (Cycle detail — تب Profit)

#### `GET /profit-extractor/status/{cycleId}`

```json
{
  "cycleId": "uuid",
  "tokenAddress": "7xKX...",
  "heldPercent": 12.5,
  "maxPercent": 10,
  "excessTokens": "1000000",
  "totalSupply": "1000000000",
  "lastExtractionAt": "..."
}
```

یا `{ "cycleId", "status": "UNAVAILABLE", "reason": "..." }`

#### `POST /profit-extractor/run`

```json
{ "cycleId": "uuid", "force": false }
```

```json
{ "jobId": "...", "status": "QUEUED", "heldPercent": 12.5, "targetPercent": 10 }
```

`status` ممکن است `SKIPPED` \| `DISABLED` \| `ALREADY_QUEUED` باشد.

#### `GET /profit-extractor/logs?cycleId=&page=&limit=`

تاریخچه extraction — paginated.

---

### ۵.۱۰ Settings (`/settings`)

#### `GET /settings`

کلیدهای integration به صورت `***` ماسک شده‌اند. RPC URLها ماسک QuickNode.

#### `PATCH /settings`

فقط فیلدهای تغییرکرده. **هرگز `***` را دوباره PATCH نکن** — یعنی «بدون تغییر».

```json
{
  "cronExpression": "0 */4 * * *",
  "networkPriority": ["SOLANA", "BSC"],
  "maxInvestmentUsd": 5000,
  "marketWalletCount": 150,
  "strategy": { "peakHoursEnabled": true, "defaultLaunchpad": "CUSTOM_RAYDIUM" },
  "treasury": { "autoDrainEnabled": false },
  "telegram": { "botToken": "new-token", "chatIds": ["-100..."] },
  "proxy": { "enabled": true, "url": "socks5://..." },
  "integrations": { "openaiApiKey": "sk-..." }
}
```

بخش‌های مهم فرم:

| بخش | فیلدها |
|-----|--------|
| Cycle | `cronExpression`, `networkPriority` |
| Budget | `maxInvestmentUsd`, `minTradeAmountUsd`, `marketWalletCount` |
| Strategy | `strategy` (object — mode, trades/min, profit, visibility) |
| **Launchpad پیش‌فرض** | `strategy.defaultLaunchpad` — یک انتخاب‌گر (dropdown) پیشنهادی: `CUSTOM_RAYDIUM` (پیش‌فرض سیستم) \| `PUMP_FUN` \| `LETS_BONK` \| `FOUR_MEME` \| `AUTO` (بازگشت به انتخاب خودکار بر اساس امتیاز GMGN/لیکوئیدیتی) |
| Safety | `securityMinScore`, `maxTokenHoldPercent` |
| Treasury | `treasury` |
| Telegram | `telegram.botToken`, `telegram.chatIds` |
| Integrations | `integrations.*` |

خطا 400: integrations نامعتبر · proxy بدون url

#### `POST /settings/proxy/test`

```json
{ "enabled": true, "url": "socks5://USER:PASS@host:45271" }
```

```json
{ "success": true, "latencyMs": 245, "message": "Proxy connection OK" }
```

---

#### `POST /telegram/test`

```json
{ "message": "Test from admin panel" }
```

```json
{
  "eventType": "TEST",
  "deliveredCount": 2,
  "failedCount": 0,
  "results": [{ "chatId": "-100...", "delivered": true }]
}
```

---

### ۵.۱۱ Treasury (`/treasury`)

> مرجع کامل: [`frontend-emergency-treasury.md`](./frontend-emergency-treasury.md)

**Drain** مقصد را از settings می‌خواند (`nativeWithdrawal*`). **Consolidate** مقصد دستی می‌گیرد.

#### `POST /treasury/drain`

| | |
|---|---|
| **Poll** | `GET /treasury/lifecycle/{jobId}` هر 5s |
| **Conflict** | 409 اگر lifecycle فعال باشد |

```json
{
  "scope": "GLOBAL",
  "networks": ["SOLANA", "BSC"],
  "convertTo": "NATIVE",
  "includeOwnerWallets": true,
  "reason": "..."
}
```

پیش‌فرض `convertTo`: `settings.treasury.lifecycle.defaultDrainConvertTo` → **`NATIVE`**.

```json
// 200
{ "jobId": "drain_...", "phase": "DRAINING", "status": "QUEUED" }
```

#### `GET /treasury/lifecycle/{jobId}`

| فیلد | توجه UI |
|------|---------|
| `mainFeeUsdBefore` / `mainFeeUsdAfter` | در drain = **withdrawalTotalUsd** (سود)، نه funding |
| `phase` | `DRAINING` → `READY` یا `WAITING_DEPOSIT` → `REARMING` |
| `status` | `QUEUED` \| `RUNNING` \| `COMPLETED` \| `FAILED` |

#### `POST /treasury/rearm`

```json
{
  "walletPoolStrategy": "AUTO",
  "marketWalletCount": 150,
  "sourceAsset": "USDC",
  "amountPerWalletUsd": 0.1,
  "startCycleAfterRearm": false
}
```

`walletPoolStrategy`: `FRESH` \| `REUSE` \| `AUTO` — funding از **funding wallet** (ChangeNOW).

#### `POST /treasury/lifecycle/run`

```json
{
  "drain": { "scope": "GLOBAL", "convertTo": "NATIVE" },
  "waitForDeposit": { "enabled": true, "minBalanceUsd": 1000, "timeoutMinutes": 60 },
  "rearm": { "walletPoolStrategy": "AUTO", "marketWalletCount": 150 },
  "startCycleAfterRearm": true
}
```

#### `POST /treasury/consolidate` + `GET /treasury/consolidate/{jobId}`

مقصد **دستی** — ops پیشرفته. Poll هر 5s.

```json
{
  "scope": "GLOBAL",
  "destinationAddress": {
    "SOLANA": "<nativeWithdrawalSolanaAddress یا آدرس مجاز>",
    "BSC": "<nativeWithdrawalBscAddress یا آدرس مجاز>"
  },
  "convertTo": "NATIVE",
  "sellAllTokens": true,
  "minSweepUsd": 0.5,
  "slippageBps": 1500
}
```

**⚠️ `includeMainFeeWallet`:** در API هست ولی backend پیاده‌سازی نکرده — در UI نشان ندهید.

---

### ۵.۱۲ Assets (عمومی)

#### `GET /assets/logos/{filename}`

بدون API Key. `filename` = `{sha256}.png` یا `.jpg`

از `trendPackage.logoUrl` در cycle detail لینک بدهید.

---

## ۶. جدول خلاصه — همه ۴۶ endpoint

| # | Method | Path | Auth | صفحه UI |
|---|--------|------|------|---------|
| 1 | GET | `/health` | — | Dashboard |
| 2 | GET | `/integrations/health` | — | Dashboard |
| 3 | GET | `/integrations/rpc/health` | — | Dashboard |
| 4 | GET | `/integrations/native-prices` | ✓ | Dashboard |
| 5 | POST | `/integrations/native-prices/refresh` | ✓ | Dashboard |
| 6 | GET | `/emergency/halt` | ✓ | Global banner |
| 7 | POST | `/emergency/brake` | ✓ | Emergency |
| 8 | GET | `/emergency/brake/{jobId}` | ✓ | Emergency |
| 9 | POST | `/emergency/resume` | ✓ | Emergency |
| 10 | GET | `/main-fee-wallet` | ✓ | Login · Dashboard |
| 11 | POST | `/main-fee-wallet/fund` | ✓ | Cycle (202) |
| 12 | GET | `/core-trigger/cycles` | ✓ | Cycles · Dashboard |
| 13 | POST | `/core-trigger/cycles` | ✓ | Start cycle |
| 14 | GET | `/core-trigger/cycles/{cycleId}` | ✓ | Cycle detail |
| 15 | POST | `/core-trigger/cycles/{cycleId}/abort` | ✓ | Cycle detail |
| 16 | GET | `/core-trigger/cycles/{cycleId}/resume` | ✓ | Cycle retry UI |
| 17 | POST | `/core-trigger/cycles/{cycleId}/retry` | ✓ | Cycle retry |
| 18 | GET | `/wallets` | ✓ | Cycle wallets |
| 19 | POST | `/wallets` | ✓ | Ops |
| 20 | GET | `/wallets/{walletId}` | ✓ | Wallet detail |
| 21 | GET | `/wallets/{walletId}/balance` | ✓ | Wallet detail |
| 22 | POST | `/trend-finder/generate` | ✓ | Debug |
| 23 | POST | `/trend-finder/regenerate/{cycleId}` | ✓ | Cycle |
| 24 | GET | `/token-factory/launchpads/best` | ✓ | Cycle ops |
| 25 | POST | `/token-factory/launch` | ✓ | Cycle ops |
| 26 | POST | `/market-generator/start` | ✓ | Cycle ops |
| 27 | GET | `/market-generator/sessions/{sessionId}` | ✓ | Cycle ops |
| 28 | POST | `/market-generator/sessions/{sessionId}/stop` | ✓ | Cycle ops |
| 29 | GET | `/token-info/{address}` | ✓ | Cycle analysis |
| 30 | GET | `/liquidity/{address}` | ✓ | Cycle analysis |
| 31 | GET | `/security/check` | ✓ | Cycle analysis |
| 32 | POST | `/security/check` | ✓ | Cycle analysis |
| 33 | GET | `/profit-extractor/status/{cycleId}` | ✓ | Cycle profit tab |
| 34 | POST | `/profit-extractor/run` | ✓ | Cycle profit tab |
| 35 | GET | `/profit-extractor/logs` | ✓ | Cycle profit tab |
| 36 | GET | `/settings` | ✓ | Settings |
| 37 | PATCH | `/settings` | ✓ | Settings |
| 38 | POST | `/settings/proxy/test` | ✓ | Settings |
| 39 | POST | `/telegram/test` | ✓ | Settings |
| 40 | POST | `/treasury/drain` | ✓ | Treasury |
| 41 | POST | `/treasury/rearm` | ✓ | Treasury |
| 42 | POST | `/treasury/lifecycle/run` | ✓ | Treasury |
| 43 | GET | `/treasury/lifecycle/{jobId}` | ✓ | Treasury |
| 44 | POST | `/treasury/consolidate` | ✓ | Treasury |
| 45 | GET | `/treasury/consolidate/{jobId}` | ✓ | Treasury |
| 46 | GET | `/assets/logos/{filename}` | — | Trend logo img |

---

## ۷. Polling — خلاصه

| Context | Endpoint | Interval | Stop when |
|---------|----------|----------|-----------|
| Halt banner | `GET /emergency/halt` | 10s | — |
| Cycle detail | `GET /core-trigger/cycles/:id` | 5s | COMPLETED / FAILED / ABORTED |
| Emergency job | `GET /emergency/brake/:jobId` | 3s | terminal status |
| Treasury drain / lifecycle / rearm | `GET /treasury/lifecycle/:jobId` | 5s | `COMPLETED` / `FAILED` / `READY` |
| Treasury consolidate | `GET /treasury/consolidate/:jobId` | 5s | terminal status |
| Dashboard health | `GET /health` + integrations | 30–60s | — |

---

## ۸. چیزهایی که در v1 نمی‌سازیم

| Feature | دلیل |
|---------|------|
| User / RBAC | API ندارد — یک API Key |
| Funding transaction list | endpoint ندارد |
| Live metrics chart API | endpoint ندارد — از cycle detail / market session |
| Sign up / Forgot password | وجود ندارد |

---

## ۹. Definition of Done — MVP پنل

1. `/login` با API Key + تست `GET /main-fee-wallet`
2. Dashboard: health + halt banner + main fee + recent cycles
3. Start cycle + poll detail تا terminal
4. Cycle detail: logs timeline + profit tab
5. Settings PATCH بدون شکستن masked `***`
6. Emergency brake + resume با confirm
7. API key در bundle commit نشود

---

## ۱۰. مراجع

| منبع | کاربرد |
|------|--------|
| `http://localhost:5420/docs` | Try it out · schema کامل |
| `http://localhost:5420/docs-json` | codegen (openapi-generator / orval) |
| `[main-info.md](./main-info.md)` | معماری بک‌اند |
| `[external-integrations.md](./external-integrations.md)` | فیلدهای integrations |

---

*v2.0 — هم‌گام با Swagger زنده · ۴۶ endpoint · بدون openapi.yaml استاتیک*
