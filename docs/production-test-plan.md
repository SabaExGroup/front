# چک‌لیست تست Production — API به API · سرویس به سرویس · Provider به Provider

> **نسخه:** 1.0 · ۲۰۲۶-۰۶-۲۶  
> **هدف:** قبل از go-live، **همه** اجزا را مو به مو تست کن — نه خلاصه فازبندی.  
> **مراجع:** [`admin-panel-spec.md`](./admin-panel-spec.md) · [`implementation-roadmap.md`](./implementation-roadmap.md) · Swagger `http://localhost:5420/docs`

---

## نحوه استفاده

1. **ترتیب را رعایت کن** — تست N تا ✅ نشود، تست N+1 را شروع نکن.
2. هر ردیف: **دستور را اجرا کن** → **معیار Pass** را چک کن → ستون ✅ را علامت بزن.
3. زمان تقریبی کل: **۴–۸ ساعت** (بدون چرخه live) · **+۲۴–۴۸ ساعت** (با چرخه ۵ wallet).
4. تست‌های 🔴 **مخرب** (Emergency GLOBAL · Drain) را **آخر** و فقط بعد از چرخه تست انجام بده.

### پیشرفت کلی

| بخش | موضوع | تعداد تست | ✅ |
|-----|--------|-----------|---|
| ۰ | زیرساخت (Postgres · Redis · MinIO) | ۸ | ✅ |
| ۱ | Build · Unit · Validation | ۵ | ✅ |
| ۲ | Process (API + Worker) | ۴ | ✅ |
| ۳ | Infra Health API | ۳ | ✅ |
| ۴ | Integration Providers (۱۴ provider) | ۱۴ | ✅ |
| ۵ | RPC Health API | ۴ | ✅ |
| ۶ | Native Prices API | ۲ | ✅ |
| ۷ | Settings API | ۵ | ✅ |
| ۸ | Auth / API Key | ۳ | ✅ |
| ۹ | Main Fee Wallet API | ۳ | ✅ |
| ۱۰ | Wallets API | ۴ | ✅ |
| ۱۱ | Trend Finder API | ۲ | ✅ |
| ۱۲ | Token Factory API | ۲ | ✅ |
| ۱۳ | Security Check API | ۲ | ✅ |
| ۱۴ | Token Info · Liquidity API | ۲ | ✅ |
| ۱۵ | Market Generator API | ۳ | ✅ |
| ۱۶ | Core Trigger / Cycles API | ۷ | ✅ |
| ۱۷ | Profit Extractor API | ۳ | ✅ |
| ۱۸ | Telegram API | ۱ | ✅ |
| ۱۹ | Assets API | ۱ | ✅ |
| ۲۰ | BullMQ Queues (Worker) | ۱۳ | ✅ |
| ۲۱ | E2E چرخه تست (۵ wallet) | ۱۲ | ☐ |
| ۲۲ | Emergency API (مخرب — محدود) | ۴ | ☐ |
| ۲۳ | Treasury API (مخرب — محدود) | ۵ | ☐ |
| **جمع** | | **~۱۰۵** | |

---

## آماده‌سازی یک‌بار (قبل از بخش ۰)

### متغیرهای ترمینال

```bash
cd /path/to/token-platform

# از .env خودت
export API_BASE="http://localhost:5420/api/v1"
export API_KEY="YOUR_API_KEY_FROM_ENV"
export PORT=5420

# helper — در همین shell نگه دار
api() {
  curl -sS -H "Content-Type: application/json" -H "X-API-Key: ${API_KEY}" \
    "${API_BASE}${1}" "${@:2}"
}
public() {
  curl -sS -H "Content-Type: application/json" "${API_BASE}${1}" "${@:2}"
}
```

### آدرس‌های نمونه (برای تست read-only)

```bash
# Wrapped SOL — برای security · token-info · liquidity
export SAMPLE_MINT="So11111111111111111111111111111111111111112"
# یک توکن pump.fun شناخته‌شده (در صورت نیاز عوض کن)
export SAMPLE_PUMP_MINT="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
```

---

## بخش ۰ — زیرساخت (سرویس به سرویس)

| # | سرویس | دستور | معیار Pass |
|---|--------|--------|------------|
| 0.1 | PostgreSQL | `pg_isready -h localhost -p 5432` یا `brew services list \| grep postgresql` | `accepting connections` |
| 0.2 | Redis | `redis-cli ping` | `PONG` |
| 0.3 | DB exists | `psql "$DATABASE_URL" -c "SELECT 1"` | یک ردیف `1` |
| 0.4 | Migrations | `npm run prisma:deploy` | بدون error |
| 0.5 | Seed | `npm run prisma:seed` | settings row وجود دارد |
| 0.6 | MinIO (اگر `STORAGE_ENABLED=true`) | `curl -s -o /dev/null -w "%{http_code}" http://localhost:9000/minio/health/live` | `200` |
| 0.7 | `.env` اجباری | `grep -E '^(API_KEY|DATABASE_URL|REDIS_URL|KMS_KEY)=' .env` | هر چهار مقدار non-empty |
| 0.8 | KMS طول | `node -e "const k=process.env.KMS_KEY||require('fs').readFileSync('.env','utf8').match(/KMS_KEY=(.+)/)?.[1]; console.log(k?.length===64?'ok':'bad')"` | `ok` (۶۴ hex) |

**Docker (production روی سرور):**

```bash
docker compose --env-file .env ps    # همه healthy
docker compose --env-file .env logs app worker --tail=20
```

---

## بخش ۱ — Build · Unit · Validation ✅

- [x] 1.1 `npm run build`
- [x] 1.2 `npm test`
- [x] 1.3 `npm run validate:integrations`
- [x] 1.4 `npm run prisma:generate`
- [x] 1.5 `npm run lint`

---

## بخش ۲ — Process (API + Worker) ✅

- [x] 2.1 API — `npm run start`
- [x] 2.2 Worker — `npm run start:worker:dev`
- [x] 2.3 پورت 5420
- [x] 2.4 Swagger `/docs`

---

## بخش ۳ — Infra Health API ✅

- [x] 3.1 `GET /health`
- [x] 3.2 `GET /health` — Redis down → `degraded`
- [x] 3.3 لاگ API — بدون `ECONNREFUSED` (حالت عادی)

---

## بخش ۴ — Integration Providers ✅

- [x] 4.1 `gmgn`
- [x] 4.2 `dexscreener`
- [x] 4.3 `changenow`
- [x] 4.4 `pricing`
- [x] 4.5 `solanaRpc`
- [x] 4.6 `bscRpc`
- [x] 4.7 `ethereumRpc`
- [x] 4.8 `etherscan`
- [x] 4.9 `solscan`
- [x] 4.10 `openai`
- [x] 4.11 `pumpPortal`
- [x] 4.12 `fourMeme`
- [x] 4.13 `letsBonk`
- [x] 4.14 `jupiter`

---

## بخش ۵ — RPC Health API ✅

- [x] 5.1 `solana.status`
- [x] 5.2 `bsc.status`
- [x] 5.3 `ethereum.status`
- [x] 5.4 `latencyMs`

---

## بخش ۶ — Native Prices API ✅

- [x] 6.1 `GET /integrations/native-prices`
- [x] 6.2 `POST /integrations/native-prices/refresh`

---

## بخش ۷ — Settings API ✅

- [x] 7.1 `GET /settings`
- [x] 7.2 `PATCH /settings` — masked secrets
- [x] 7.3 `PATCH /settings` — proxy
- [x] 7.4 `POST /settings/proxy/test`
- [x] 7.5 `PATCH /settings` — مقادیر تست

---

## بخش ۸ — Auth / API Key ✅

- [x] 8.1 بدون key → `401`
- [x] 8.2 key اشتباه → `401`
- [x] 8.3 key درست → `200`

---

## بخش ۹ — Main Fee Wallet API ✅

- [x] 9.1 `GET /main-fee-wallet`
- [x] 9.2 آدرس مشتق‌شده

---

## بخش ۱۰ — Wallets API ✅

- [x] 10.1 `GET /wallets`
- [x] 10.2 `POST /wallets` — batch تست
- [x] 10.3 `GET /wallets/{walletId}`
- [x] 10.4 `GET /wallets/{walletId}/balance`

---

## بخش ۱۱ — Trend Finder API ✅

- [x] 11.1 `POST /trend-finder/generate`

---

## بخش ۱۲ — Token Factory API ✅

- [x] 12.1 `GET /token-factory/launchpads/best`

---

## بخش ۱۳ — Security Check API ✅

- [x] 13.1 `GET /security/check`
- [x] 13.2 `POST /security/check`

---

## بخش ۱۴ — Token Info · Liquidity API ✅

- [x] 14.1 `GET /token-info/{address}`
- [x] 14.2 `GET /liquidity/{address}`

---

## بخش ۱۵ — Market Generator API ✅

- [x] 15.1 `POST /market-generator/start`
- [x] 15.2 `GET /market-generator/sessions/{sessionId}`
- [x] 15.3 `POST /market-generator/sessions/{sessionId}/stop`

---

## بخش ۱۶ — Core Trigger / Cycles API ✅

- [x] 16.1 `GET /emergency/halt`
- [x] 16.2 `POST /core-trigger/cycles`
- [x] 16.3 `GET /core-trigger/cycles`
- [x] 16.4 `GET /core-trigger/cycles/{cycleId}`
- [x] 16.5 `GET /core-trigger/cycles/{cycleId}/resume`
- [x] 16.6 `POST /core-trigger/cycles/{cycleId}/retry`
- [x] 16.7 `POST /core-trigger/cycles/{cycleId}/abort`

---

## بخش ۱۷ — Profit Extractor API ✅

- [x] 17.1 `GET /profit-extractor/status/{cycleId}`
- [x] 17.2 `POST /profit-extractor/run`
- [x] 17.3 `GET /profit-extractor/logs`

---

## بخش ۱۸ — Telegram API ✅

- [x] 18.1 `POST /telegram/test`

---

## بخش ۱۹ — Assets API ✅

- [x] 19.1 `GET /assets/logos/{filename}` (public)

---

## بخش ۲۰ — BullMQ Queues (Worker) ✅

- [x] 20.1 `cycle-orchestrator`
- [x] 20.2 `wallet-funding`
- [x] 20.3 `market-making`
- [x] 20.4 `rpc-submit`
- [x] 20.5 `telegram-notify`
- [x] 20.6 `consolidate-sell`
- [x] 20.7 `consolidate-sweep`
- [x] 20.8 `consolidate-transfer`
- [x] 20.9 `emergency-sell`
- [x] 20.10 `emergency-sweep`
- [x] 20.11 `profit-extract`
- [x] 20.12 `lifecycle-drain`
- [x] 20.13 `lifecycle-rearm`

---

## بخش ۲۱ — E2E چرخه تست (۵ wallet · ~$400)

پیش‌نیاز: بخش ۰–۲۰ ✅ · Main Fee شارژ شده.

| # | گام | action | معیار Pass |
|---|-----|--------|------------|
| 21.1 | Settings تست | بخش ۷.۵ | `marketWalletCount: 5` |
| 21.2 | Halt check | `GET /emergency/halt` | `halted: false` |
| 21.3 | Start | `POST /core-trigger/cycles` | `200` · `id` |
| 21.4 | Trend | poll تا `SECURITY_CHECK` | TrendPackage در detail |
| 21.5 | Security | خودکار | `SecurityReport.isSafe: true` |
| 21.6 | Funding | poll `FUNDING` | همه `FundingTransaction` → `COMPLETED` |
| 21.7 | Launch | poll `TOKEN_LAUNCH` | mint + txHash on Solscan |
| 21.8 | Market | poll `MARKET_MAKING` | ≥ ۱۰ `Trade` با `txHash` |
| 21.9 | Complete | poll | `status: COMPLETED` |
| 21.10 | Telegram | — | `CYCLE_COMPLETE` دریافت |
| 21.11 | Profit | بخش ۱۷ | cap رعایت شده |
| 21.12 | DB | `npm run prisma:studio` | FundingTransaction · Trade · Cycle |

**Prisma Studio چک:**

| Model | انتظار |
|-------|--------|
| `FundingTransaction` | ۶ ردیف (۱ owner + ۵ market) · همه `COMPLETED` |
| `Trade` | `txHash` NOT NULL |
| `SecurityReport` | `isSafe: true` |
| `Cycle` | `COMPLETED` · `netProfitUsd` ثبت شده |

---

## بخش ۲۲ — Emergency API 🔴 (مخرب — آخر)

> فقط روی **چرخه تست تمام‌شده** یا با `scope: CYCLE`.  
> `GLOBAL` همه چرخه‌ها را halt می‌کند.

### 22.1 `POST /emergency/brake` — CYCLE scope

```bash
api -X POST /emergency/brake -d '{
  "scope": "CYCLE",
  "cycleId": "'${CYCLE_ID}'",
  "convertTo": "NATIVE",
  "reason": "production test plan brake"
}' | jq '{jobId, status}'
export BRAKE_JOB_ID="..."
```

### 22.2 `GET /emergency/brake/{jobId}` — poll

```bash
watch -n 3 "api /emergency/brake/${BRAKE_JOB_ID} | jq '{status, progress}'"
```

### 22.3 `GET /emergency/halt`

```bash
api /emergency/halt | jq .
# بعد از GLOBAL: halted true · بعد از CYCLE: بسته به scope
```

### 22.4 `POST /emergency/resume`

```bash
api -X POST /emergency/resume -d '{"jobId":"'${BRAKE_JOB_ID}'"}' | jq .
api /emergency/halt | jq .halted   # باید false شود
```

---

## بخش ۲۳ — Treasury API 🔴 (مخرب — آخر)

### 23.1 `POST /treasury/consolidate`

```bash
api -X POST /treasury/consolidate -d '{
  "networks": ["SOLANA"],
  "convertTo": "NATIVE",
  "sellAllTokens": true,
  "destinationAddress": {"SOLANA": "YOUR_WITHDRAWAL_SOL_ADDRESS"},
  "minSweepUsd": 0.5,
  "slippageBps": 1500
}' | jq '{jobId}'
```

### 23.2 `GET /treasury/consolidate/{jobId}`

```bash
watch -n 5 "api /treasury/consolidate/${JOB_ID} | jq '{status, progress}'"
```

### 23.3 `POST /treasury/drain`

```bash
api -X POST /treasury/drain -d '{
  "scope": "GLOBAL",
  "convertTo": "NATIVE",
  "includeOwnerWallets": true
}' | jq .
```

### 23.4 `POST /treasury/rearm`

```bash
api -X POST /treasury/rearm -d '{
  "strategy": "FRESH",
  "networks": ["SOLANA"]
}' | jq .
```

### 23.5 `POST /treasury/lifecycle/run` + poll

```bash
api -X POST /treasury/lifecycle/run -d '{
  "mode": "DRAIN",
  "convertTo": "NATIVE"
}' | jq '{jobId}'
watch -n 5 "api /treasury/lifecycle/${JOB_ID} | jq '{phase, status}'"
```

---

## جدول کامل ۴۶ Endpoint — مرجع سریع

| # | Method | Path | Auth | بخش تست |
|---|--------|------|------|---------|
| 1 | GET | `/health` | — | ۳ |
| 2 | GET | `/integrations/health` | — | ۴ |
| 3 | GET | `/integrations/rpc/health` | — | ۵ |
| 4 | GET | `/integrations/native-prices` | ✓ | ۶ |
| 5 | POST | `/integrations/native-prices/refresh` | ✓ | ۶ |
| 6 | GET | `/emergency/halt` | ✓ | ۱۶ · ۲۲ |
| 7 | POST | `/emergency/brake` | ✓ | ۲۲ |
| 8 | GET | `/emergency/brake/{jobId}` | ✓ | ۲۲ |
| 9 | POST | `/emergency/resume` | ✓ | ۲۲ |
| 10 | GET | `/main-fee-wallet` | ✓ | ۹ |
| 11 | POST | `/main-fee-wallet/fund` | ✓ | ۹ · ۲۱ |
| 12 | GET | `/core-trigger/cycles` | ✓ | ۱۶ |
| 13 | POST | `/core-trigger/cycles` | ✓ | ۱۶ · ۲۱ |
| 14 | GET | `/core-trigger/cycles/{id}` | ✓ | ۱۶ · ۲۱ |
| 15 | POST | `/core-trigger/cycles/{id}/abort` | ✓ | ۱۶ |
| 16 | GET | `/core-trigger/cycles/{id}/resume` | ✓ | ۱۶ |
| 17 | POST | `/core-trigger/cycles/{id}/retry` | ✓ | ۱۶ |
| 18 | GET | `/wallets` | ✓ | ۱۰ |
| 19 | POST | `/wallets` | ✓ | ۱۰ |
| 20 | GET | `/wallets/{id}` | ✓ | ۱۰ |
| 21 | GET | `/wallets/{id}/balance` | ✓ | ۱۰ |
| 22 | POST | `/trend-finder/generate` | ✓ | ۱۱ |
| 23 | POST | `/trend-finder/regenerate/{cycleId}` | ✓ | ۱۱ |
| 24 | GET | `/token-factory/launchpads/best` | ✓ | ۱۲ |
| 25 | POST | `/token-factory/launch` | ✓ | ۱۲ |
| 26 | POST | `/market-generator/start` | ✓ | ۱۵ |
| 27 | GET | `/market-generator/sessions/{id}` | ✓ | ۱۵ |
| 28 | POST | `/market-generator/sessions/{id}/stop` | ✓ | ۱۵ |
| 29 | GET | `/token-info/{address}` | ✓ | ۱۴ |
| 30 | GET | `/liquidity/{address}` | ✓ | ۱۴ |
| 31 | GET | `/security/check` | ✓ | ۱۳ |
| 32 | POST | `/security/check` | ✓ | ۱۳ |
| 33 | GET | `/profit-extractor/status/{cycleId}` | ✓ | ۱۷ |
| 34 | POST | `/profit-extractor/run` | ✓ | ۱۷ |
| 35 | GET | `/profit-extractor/logs` | ✓ | ۱۷ |
| 36 | GET | `/settings` | ✓ | ۷ |
| 37 | PATCH | `/settings` | ✓ | ۷ |
| 38 | POST | `/settings/proxy/test` | ✓ | ۴ · ۷ |
| 39 | POST | `/telegram/test` | ✓ | ۱۸ |
| 40 | POST | `/treasury/drain` | ✓ | ۲۳ |
| 41 | POST | `/treasury/rearm` | ✓ | ۲۳ |
| 42 | POST | `/treasury/lifecycle/run` | ✓ | ۲۳ |
| 43 | GET | `/treasury/lifecycle/{jobId}` | ✓ | ۲۳ |
| 44 | POST | `/treasury/consolidate` | ✓ | ۲۳ |
| 45 | GET | `/treasury/consolidate/{jobId}` | ✓ | ۲۳ |
| 46 | GET | `/assets/logos/{filename}` | — | ۱۹ |

---

## Troubleshooting سریع

| symptom | علت | fix |
|---------|-----|-----|
| `ECONNREFUSED` از Vite/admin | API خاموش | `npm run start:dev` |
| `Invalid URL` در proxy test | `url: "***"` | PATCH با URL کامل یا fix stripMasked |
| `ENOTFOUND api.etherscan.io` | DNS لوکال | proxy enabled · socks5h |
| cycle stuck `FUNDING` | worker down | `npm run start:worker:dev` |
| `below ChangeNOW minimum` | amount کم | `minTradeAmountUsd` ↑ یا صبر |
| `halted: true` | emergency | `POST /emergency/resume` |
| trade بدون txHash | dryRun / RPC | `dryRun: false` · RPC health |
| latency ~۱s همه providers | ایران + پروکسی آلمان | طبیعی · روی سرور بهتر می‌شود |

---

## Definition of Done — آماده Production

- [ ] بخش ۰–۲۰: همه ✅
- [ ] بخش ۲۱: یک چرخه `COMPLETED` با ۵ wallet
- [ ] بخش ۲۲–۲۳: emergency + treasury تست شده
- [ ] `sellInRed: false` تأیید
- [ ] Settings production PATCH: `marketWalletCount: 200` · `maxInvestmentUsd: 5000`
- [ ] Main Fee ≥ $5K (+ $150 ETH buffer)
- [ ] Worker روی سرور با `restart: unless-stopped` · scale ۲–۳
- [ ] `.env` / keys در git commit نشده

---

*مرجع ماژول‌ها: [`main-info.md`](./main-info.md) · هزینه: [`cost-model.md`](./cost-model.md) · کلیدها: [`external-integrations.md`](./external-integrations.md)*
