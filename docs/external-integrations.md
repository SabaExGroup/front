# External Integrations — مستند کامل APIهای خارجی

> **نسخه: 3.0 — Production Go-Live** (۲۰۲۶-۰۶-۲۲)  
> **وضعیت:** ✅ همه clientها wired · health probes · on-chain verify · **ChangeNOW min/fee documented**  
> Stack: NestJS · Settings-driven (نه `.env` برای API keys)  
> مرجع: [`main-info.md`](./main-info.md) §11 · [`implementation-roadmap.md`](./implementation-roadmap.md) v3.0 · [`cost-model.md`](./cost-model.md) v3.0  
> Seed: [`settings.defaults.json`](./settings.defaults.json) · پرامپت: [`cursor-stage-prompts.md`](./cursor-stage-prompts.md)

---

### مستندات اکوسیستم v3

| سند | نقش |
|-----|-----|
| **این فایل** | API keys · endpoints · ChangeNOW · health · runbook |
| [`cost-model.md`](./cost-model.md) | سرمایه · burn · ChangeNOW ETH gas · tier $5K/$10K |
| [`implementation-roadmap.md`](./implementation-roadmap.md) | فاز A–D go-live · verify per ماژول |
| [`cursor-stage-prompts.md`](./cursor-stage-prompts.md) | پرامپت copy-paste برای Agent |

---

### وضعیت production — یک نگاه

| لایه | تضمین |
|------|--------|
| **Config** | `validateMergedIntegrations` · PATCH 400 روی RPC نامعتبر · mask `***` |
| **Health** | ۱۳ provider probe · timeout 12s · placeholder → `degraded` فوری |
| **Funding** | ChangeNOW v2 · poll · deposit on-chain · **getMinAmountV2 validate** · refund از main fee key |
| **Trade** | Pump/LetsBonk/FourMeme SDK on-chain · GMGN optional · RPC verify |
| **Security** | GMGN scorer · benchmark از trending · Redis cache 300s |
| **Prices** | GMGN + DexScreener + ChangeNOW median · stale fallback |
| **Cache** | `IntegrationsCacheInvalidator` بعد از PATCH settings |

> **چه API Key / URL بگیرم؟** → [§0 جدول چک Credentials](#0-جدول-چک-credentials--چه-چیزی-از-کجا-بگیری)

---

## فهرست

0. [**جدول چک Credentials — چه چیزی از کجا بگیری؟**](#0-جدول-چک-credentials--چه-چیزی-از-کجا-بگیری)
1. [GMGN OpenAPI — مرکز یکپارچه‌سازی](#1-gmgn-openapi)
2. [GMGN Security — Gate قبل از Funding](#2-gmgn-security)
3. [ChangeNOW API — فلو کامل Funding](#3-changenow-api)
4. [Pump.fun — Create + Buy + Sell](#4-pumpfun)
5. [FourMeme — Create + Buy + Sell](#5-fourmeme)
6. [LetsBonk — Raydium LaunchLab](#6-letsbonk)
7. [NestJS Client Map](#7-nestjs-client-map)
8. [Explorers — Etherscan v2 + Solscan](#8-explorers--etherscan-v2--solscan)
9. [RPC Layer — QuickNode Solana + BSC + Ethereum](#9-rpc-layer--quicknode)
10. [OpenAI — Trend Finder](#10-openai--trend-finder)
11. [DexScreener + Native Prices](#11-dexscreener--native-prices)
12. [Health · Validation · Errors](#12-health--validation--errors)
13. [Performance Matrix + Runbook](#13-performance-matrix--runbook)

---

## 0. جدول چک Credentials — چه چیزی از کجا بگیری؟

> **هدف:** لیست دقیق همه providerها — API Key · URL · Private Key · سرمایه — برای **۱۰۰٪ اتوماسیون**  
> **محل تنظیم:** تقریباً همه چیز → `PATCH /api/v1/settings` (PostgreSQL) · فقط زیرساخت → `.env`  
> **Seed اولیه:** [`settings.defaults.json`](./settings.defaults.json) · **اعتبارسنجی:** `npm run validate:integrations`

### 0.1 اصل — دو لایه تنظیم

| لایه | محل | چه چیزهایی |
|------|-----|------------|
| **زیرساخت** | `.env` (یا `docker-compose` environment) | `DATABASE_URL` · `REDIS_URL` · `KMS_KEY` · `API_KEY` · `PORT` |
| **Integrations + عملیات** | `PATCH /api/v1/settings` | همه API key · RPC URL · private key main fee · Telegram · Proxy |

```bash
# فقط زیرساخت — یک بار
cp .env.example .env   # KMS_KEY را با 64 hex تصادفی عوض کن

# همه integrations — بعد از boot
curl -X PATCH http://localhost:5420/api/v1/settings \
  -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  -d @my-production-settings.json
```

> `GET /settings` کلیدها را `***` نشان می‌دهد. PATCH با `***` overwrite **نمی‌کند**.

---

### 0.2 جدول اصلی — همه سرویس‌های خارجی

**راهنمای ستون «الزامی»:**

| نماد | معنی |
|------|------|
| 🔴 **BLOCK** | بدون آن چرخه live متوقف می‌شود |
| 🟠 **MODULE** | یک ماژول/شبکه خاص fail — بقیه ممکن است کار کند |
| 🟡 **RECOMMENDED** | سیستم کار می‌کند ولی health degraded / بدون گزارش |
| 🟢 **OPTIONAL** | مسیر جایگزین on-chain داریم |
| ⚪ **NONE** | API key لازم نیست |

| # | Provider / سرویس | الزامی | فیلد Settings (مسیر JSON) | API URL / Endpoint | Secret / Key | از کجا بگیرم | بدون آن چه می‌شود | چک |
|---|------------------|--------|---------------------------|-------------------|--------------|--------------|-------------------|-----|
| 1 | **QuickNode — Solana RPC** | 🔴 BLOCK | `integrations.solanaRpcUrl` | `https://{name}.solana-mainnet.quiknode.pro/{token}/` | URL embeds token | [quicknode.com](https://www.quicknode.com/) → Create endpoint → Solana Mainnet | لانچ Sol · trade · balance · verify TX ناممکن | [ ] |
| 2 | **QuickNode — BSC RPC** | 🔴 BLOCK | `integrations.evmRpcUrl` | `https://{name}.bsc.quiknode.pro/{token}/` | URL embeds token | QuickNode → BNB Smart Chain Mainnet | FourMeme · BNB trade · verify ناممکن | [ ] |
| 3 | **QuickNode — Ethereum RPC** | 🔴 BLOCK | `integrations.ethereumRpcUrl` | `https://{name}.ethereum-mainnet.quiknode.pro/{token}/` | URL embeds token | QuickNode → Ethereum Mainnet | ChangeNOW deposit USDC/ETH · refund path ناممکن | [ ] |
| 4 | **Solana WebSocket** (اختیاری) | 🟢 OPTIONAL | `integrations.solanaRpcWsUrl` | `wss://...` (همان host QuickNode) | در URL | QuickNode → Show WSS | خالی = auto از HTTP ساخته می‌شود | [ ] |
| 5 | **Main Fee — EVM Private Key** | 🔴 BLOCK | `integrations.mainFeeWalletEvmPrivateKey` | — | `0x` + 64 hex (Ethereum/BSC همان آدرس) | ولت جدید امن · **هرگز commit نکن** | Funding: deposit به ChangeNOW نمی‌رود · آدرس main ثابت نیست | [ ] |
| 6 | **سرمایه Main Fee** (on-chain) | 🔴 BLOCK | — (موجودی ولت) | — | **65% USDC + 25% ETH** روی **Ethereum mainnet** (آدرس کلید #5) · جزئیات [`cost-model.md`](./cost-model.md) | واریز به `GET /main-fee-wallet` | ChangeNOW `waiting`/`expired` · deposit gas fail · ولت‌ها خالی | [ ] |
| 7 | **ChangeNOW** | 🔴 BLOCK | `integrations.changeNowApiKey` | `integrations.endpoints.changeNowBaseUrlV2` (پیش‌فرض OK) | API key header `x-changenow-api-key` | [changenow.io/for-partners](https://changenow.io/for-partners) | Funding SOL/BNB به market wallets انجام نمی‌شود | [ ] |
| 8 | **GMGN OpenAPI** | 🔴 BLOCK | `integrations.gmgnApiKey` | `integrations.endpoints.gmgnBaseUrl` → `https://openapi.gmgn.ai` | Header `X-APIKEY` | GMGN / OpenAPI dashboard (Skills doc) | Security gate · TokenInfo · Liquidity · Launchpad · قیمت SOL fail | [ ] |
| 9 | **GMGN Trade Signing** | ⚪ UNUSED | `integrations.gmgnPrivateKey` | — | PEM برای swap GMGN | — | **استفاده نمی‌شود** — launch/trade فقط PumpPortal + FourMeme on-chain با ولت‌های KMS | [ ] |
| 10 | **OpenAI** | 🔴 BLOCK | `integrations.openaiApiKey` | `integrations.endpoints.openaiBaseUrl` | `Bearer sk-...` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) | Trend (نام·symbol·لوگو·description) fail → چرخه در step 1 | [ ] |
| 11 | **OpenAI Model** | 🔴 BLOCK | `openaiModel` (root settings) | — | نام مدل e.g. `gpt-4o` | همان اکانت OpenAI | chat completion fail | [ ] |
| 12 | **DexScreener** | ⚪ NONE | — (فقط endpoint) | `integrations.endpoints.dexScreenerBaseUrl` | **بدون key** (public) | پیش‌فرض را نگه دار | قیمت native ضعیف‌تر · visibility DexScreener کمتر | [ ] |
| 13 | **Pump.fun — On-chain SDK** | 🔴 BLOCK* | — | Solana RPC (#1) | کلیدهای ولت داخل DB (KMS) | خودکار — `WalletGenerator` | لانچ/trade Sol روی Pump ناممکن | [ ] |
| 14 | **PumpPortal Local** (`trade-local`) | 🟢 OPTIONAL | `integrations.pumpPortalApiKey` — **معمولاً خالی** | `integrations.endpoints.pumpPortalApiUrl` | Bearer اختیاری؛ docs رسمی بدون key | [pumpportal.fun](https://pumpportal.fun) | build TX برای **هر** `publicKey` — امضا با KMS | [ ] |
| 14b | **PumpPortal Lightning** (`/api/trade`) | ⚪ **استفاده نمی‌شود** | API key = یک ولت Lightning | query `?api-key=` | کلید شامل private key رمزشده همان ولت | pumpportal.fun | **یک ولت ثابت** — با ۲۰۰ ولت market سازگار نیست | [ ] |
| 15 | **Pump.fun Frontend API v3** | ⚪ **استفاده نمی‌شود** (flow فعلی) | `integrations.pumpFunJwtToken` | `integrations.endpoints.pumpFunApiV3Url` | JWT = session ولت pump.fun | login pump.fun | فقط `createCoin` — ما `buildMetadataUri` (data URI) داریم | [ ] |
| 16 | **FourMeme** | 🔴 BLOCK* | — | `integrations.endpoints.fourMemeApiUrl` | **بدون API key جدا** — login با امضای `TOKEN_OWNER` wallet | four.meme — فقط BSC RPC (#2) + owner wallet funded | لانچ/trade BSC ناممکن | [ ] |
| 17 | **LetsBonk / Raydium LaunchLab** | 🔴 BLOCK* | — (runtime در defaults) | Solana RPC (#1) | کلید ولت owner (KMS) | on-chain only | لانچ LetsBonk ناممکن | [ ] |
| 18 | **Etherscan API v2** | 🟡 RECOMMENDED | `integrations.etherscanApiKey` | `integrations.endpoints.etherscanBaseUrl` | `apikey` query param | [etherscan.io/apidashboard](https://etherscan.io/apidashboard) — **یک key همه EVM** | Explorer audit · gas oracle health degraded | [ ] |
| 19 | **Solscan Pro** | 🟡 RECOMMENDED | `integrations.solanaScanApiKey` | `integrations.endpoints.solanaScanBaseUrl` | Header `token:` | [solscan.io/apis](https://solscan.io/apis) | Health probe degraded · verify اصلی از RPC است | [ ] |
| 20 | **Telegram Bot** | 🟡 RECOMMENDED | `telegram.botToken` | `https://api.telegram.org/bot{token}/` | Bot token از @BotFather | Telegram → @BotFather → `/newbot` | بدون alert عملیاتی · چرخه silent fail | [ ] |
| 21 | **Telegram Chats** | 🟡 RECOMMENDED | `telegram.chatIds` | — | آرایه chat ID عددی | @userinfobot یا گروه admin | پیام گزارش ارسال نمی‌شود | [ ] |
| 22 | **Proxy** | 🟢 OPTIONAL | `proxy.enabled` + `proxy.url` | `socks5://` یا `http://` | user:pass@host:port | VPS proxy اگر IP ban | GMGN/OpenAI/ChangeNOW از IP ثابت دیگر | [ ] |
| 23 | **PostgreSQL** | 🔴 BLOCK | `.env` → `DATABASE_URL` | `postgresql://...` | user/pass | Docker local یا managed DB | اپ بالا نمی‌آید | [ ] |
| 24 | **Redis** | 🔴 BLOCK | `.env` → `REDIS_URL` | `redis://...` | — | Docker / managed Redis | BullMQ · cache · lock کار نمی‌کند | [ ] |
| 25 | **KMS (wallet encryption)** | 🔴 BLOCK | `.env` → `KMS_KEY` | — | 64 hex chars (32 bytes) | `openssl rand -hex 32` — **backup امن** | decrypt کلید ولت‌ها fail | [ ] |
| 26 | **Admin API Key** | 🔴 BLOCK | `.env` → `API_KEY` | — | string قوی | خودت تعریف کن | REST / PATCH settings بدون auth | [ ] |
| 27 | **BullMQ Worker process** | 🔴 BLOCK | — | `npm run start:worker` | — | deploy کن | funding · market · profit queue اجرا نمی‌شود | [ ] |

\* ردیف ۱۳–۱۷: API key ثبت‌نام ندارند — **RPC + ولت‌های تولیدشده سیستم** کافی است.

---

### 0.3 جدول Endpointها — معمولاً تغییر نده

| فیلد `integrations.endpoints.*` | URL پیش‌فرض | تغییر بده؟ |
|---------------------------------|-------------|------------|
| `gmgnBaseUrl` | `https://openapi.gmgn.ai` | فقط اگر GMGN URL عوض کند |
| `changeNowBaseUrlV1` | `https://api.changenow.io/v1` | نادر |
| `changeNowBaseUrlV2` | `https://api.changenow.io/v2` | نادر |
| `pumpFunApiV3Url` | `https://frontend-api-v3.pump.fun` | نادر |
| `pumpPortalApiUrl` | `https://pumpportal.fun/api` | نادر |
| `fourMemeApiUrl` | `https://four.meme/meme-api/v1` | نادر |
| `openaiBaseUrl` | `https://api.openai.com/v1` | فقط Azure/OpenAI-compatible |
| `dexScreenerBaseUrl` | `https://api.dexscreener.com` | نادر |
| `etherscanBaseUrl` | `https://api.etherscan.io/v2/api` | نادر |
| `solanaScanBaseUrl` | `https://pro-api.solscan.io/v2.0` | نادر |

---

### 0.4 چک‌لیست بر اساس موج چرخه (چه موقع لازم است)

| موج | مرحله | Providerهای مورد نیاز (حداقل) |
|-----|-------|------------------------------|
| **Boot** | قبل از هر چیز | #23 PostgreSQL · #24 Redis · #25 KMS · #26 API_KEY · #27 Worker |
| **موج A — چرخه زنده** | Trend → Launch | #10–11 OpenAI · #8 GMGN · #1–3 RPC · #5–7 Main fee + ChangeNOW · #13–17 Launchpad path |
| **موج B — سود** | Market + Extract | همان‌ها + RPC سریع (#1–2) · GMGN (#8) برای metrics |
| **موج C — عملیات** | Emergency · Treasury | #1–2 RPC · #20–21 Telegram · (اختیاری #18–19 explorer) |

---

### 0.5 حداقل vs ۱۰۰٪ کامل

| سطح | باید داشته باشی | نتیجه |
|-----|-----------------|--------|
| **حداقل dev/dry-run** | `.env` زیرساخت · OpenAI · GMGN · RPC placeholder → `validate:integrations` | build/test سبز · dry-run cycle |
| **حداقل live (۵ ولت تست)** | همه 🔴 BLOCK · Main Fee ≥ **$500 USDC + $100 ETH**@Ethereum · worker | یک چرخه `COMPLETED` |
| **production Blitz ($5K)** | همه 🔴 + 🟡 · Main Fee **$5K** (۳.25K USDC + **$200 ETH**) · **200 wallet** · RPC premium | Bot Magnet 12/12 · TWAP · Telegram |
| **راحت ($10K buffer)** | همان + **$10K** Main Fee | ~۱۵ چرخه buffer · drain هر ۵–۱۰ چرخه |

---

### 0.6 نمونه `integrations` برای PATCH (اسکلت)

```json
{
  "integrations": {
    "openaiApiKey": "sk-...",
    "gmgnApiKey": "...",
    "gmgnPrivateKey": "",
    "changeNowApiKey": "...",
    "mainFeeWalletEvmPrivateKey": "0x...",
    "solanaRpcUrl": "https://xxx.solana-mainnet.quiknode.pro/yyy/",
    "solanaRpcWsUrl": "",
    "evmRpcUrl": "https://xxx.bsc.quiknode.pro/yyy/",
    "ethereumRpcUrl": "https://xxx.ethereum-mainnet.quiknode.pro/yyy/",
    "etherscanApiKey": "...",
    "solanaScanApiKey": "...",
    "pumpPortalApiKey": "",
    "pumpFunJwtToken": ""
  },
  "telegram": {
    "botToken": "123456:ABC...",
    "chatIds": ["-100xxxxxxxxxx"]
  },
  "proxy": { "enabled": false, "url": "" }
}
```

### 0.7 تأیید نهایی — همه چک‌باکس‌ها

```bash
npm run validate:integrations

curl -s http://localhost:5420/api/v1/integrations/health | jq '.status, .providers'
curl -s http://localhost:5420/api/v1/integrations/rpc/health | jq
curl -s http://localhost:5420/api/v1/main-fee-wallet -H "X-API-Key: $API_KEY" | jq '.totalUsd, .bscAddress'
```

| probe | باید ببینی |
|-------|------------|
| `gmgn` | `up` |
| `changenow` | `up` |
| `openai` | `up` |
| `solana-rpc` · `bsc-rpc` · `ethereum-rpc` | `up` |
| `solana-rpc` placeholder | `degraded` نه hang |
| `native-prices` | `up` |

> جزئیات recovery: §13.4 · Runbook کامل: [`main-info.md`](./main-info.md) §25

---

## 1. GMGN OpenAPI

### 1.1 Overview


| مشخصه         | مقدار                                                                                        |
| ------------- | -------------------------------------------------------------------------------------------- |
| Base URL      | `https://openapi.gmgn.ai` (settings: `integrations.endpoints.gmgnBaseUrl`)                   |
| NestJS Client | `GmgnClient` + `GmgnAuthService` + `GmgnSecurityScorer`                                     |
| Chains        | `sol`, `bsc` (production) · `base`, `eth`, `monad` (types supported)                         |
| Docs          | [GMGN Skills — gmgn-token](https://github.com/GMGNAI/gmgn-skills)                            |
| Method parity | **27** methods — `GmgnClient.methodParity()` ≡ `GMGN_METHOD_PARITY`                          |


**نقش در سیستم ما:** فقط **read-only** — TokenInfo، LiquidityAnalyzer، SecurityCheck، Launchpad scoring، Trending، قیمت native. **هیچ trade یا create توکن از GMGN اجرا نمی‌شود** (ولت‌های سیستم با KMS امضا می‌کنند؛ GMGN فقط به ولت متصل اکانت کار می‌کند).

### 1.2 Authentication

#### Normal Auth (read endpoints)

```
Headers:
  X-APIKEY: {GMGN_API_KEY}

Query (required on every request):
  timestamp: {unix_seconds}   # Math.floor(Date.now() / 1000), valid within ±5s
  client_id: {uuid_v4}        # unique per request; replays within 7s rejected
```

#### Critical Auth (trade endpoints — swap, multiSwap, createToken)

```
Headers:
  X-APIKEY: {GMGN_API_KEY}
  X-Signature: {signed_message}

Signature message format:
  {sub_path}:{sorted_query_string}:{request_body}:{timestamp}

Signing: Ed25519 or RSA-PSS+SHA256 (salt length 32)
Env: `gmgnApiKey` + `gmgnPrivateKey` (PEM) — **از Settings DB**، نه `.env`
```

> **Rate limit:** `429 RATE_LIMIT_EXCEEDED` — **۱× auto-retry** با wait تا `rateLimitMaxWaitMs` (settings).  
> **Hard stops:** `401 NONCE_REPLAYED` (client_id reused within 7s), `403 TRADE_WALLET_MISMATCH`.  
> **Retries:** `runtime.gmgn.httpRetries` (default 3) برای transient HTTP errors.

### 1.3 Endpoint Catalog (27 methods)


| Method                  | HTTP | Path                            | Auth     | Weight | NestJS Use                      |
| ----------------------- | ---- | ------------------------------- | -------- | ------ | ------------------------------- |
| `getTokenInfo`          | GET  | `/v1/token/info`                | normal   | 1      | TokenInfoService                |
| `getTokenSecurity`      | GET  | `/v1/token/security`            | normal   | 1      | **SecurityCheckService**        |
| `getTokenPoolInfo`      | GET  | `/v1/token/pool_info`           | normal   | 1      | LiquidityAnalyzer               |
| `getTokenTopHolders`    | GET  | `/v1/market/token_top_holders`  | normal   | 5      | Launchpad scoring               |
| `getTokenTopTraders`    | GET  | `/v1/market/token_top_traders`  | normal   | 5      | Market sentiment                |
| `getTokenKline`         | GET  | `/v1/market/token_kline`        | normal   | 1      | Price momentum                  |
| `getTrendingSwaps`      | GET  | `/v1/market/rank`               | normal   | 1      | Launchpad selection             |
| `getTokenSignalV2`      | POST | `/v1/market/token_signal`       | normal   | 1      | Trend discovery                 |
| `getTrenches`           | POST | `/v1/trenches`                  | normal   | 1      | New token watch                 |
| `getWalletHoldings`     | GET  | `/v1/user/wallet_holdings`      | normal   | 1      | Profit Extractor                |
| `getWalletTokenBalance` | GET  | `/v1/user/wallet_token_balance` | normal   | 1      | Holdings calc                   |
| `quoteOrder`            | GET  | `/v1/trade/quote`               | critical | —      | Pre-trade quote                 |
| `swap`                  | POST | `/v1/trade/swap`                | critical | —      | Single wallet trade             |
| `multiSwap`             | POST | `/v1/trade/multi_swap`          | critical | —      | **100–200 wallet batch trades** |
| `queryOrder`            | GET  | `/v1/trade/query_order`         | critical | —      | Order status poll               |
| `createToken`           | POST | `/v1/cooking/create_token`      | critical | —      | Optional token create           |


### 1.4 Request Examples

#### GET /v1/token/info

```http
GET https://openapi.gmgn.ai/v1/token/info?chain=sol&address={mint}&timestamp={ts}&client_id={uuid}
X-APIKEY: {key}
```

**Key response fields:**

- `price.price`, `price.volume_24h`, `price.market_cap`
- `liquidity`, `holder_count`
- `price.buys_5m`, `price.sells_5m`, `price.volume_5m`
- `wallet_tags_stat.smart_wallets`, `wallet_tags_stat.renowned_wallets`
- `link.twitter_username`, `link.website`, `link.telegram`

#### GET /v1/token/pool_info

```http
GET https://openapi.gmgn.ai/v1/token/pool_info?chain=sol&address={mint}&timestamp={ts}&client_id={uuid}
X-APIKEY: {key}
```

**Key fields:** `liquidity` (USD), `exchange` (pump_amm | raydium | meteora_dlmm), `base_reserve`, `quote_reserve`, `price`

#### POST /v1/trade/multi_swap (Market Making — alternative path)

```json
{
  "chain": "sol",
  "accounts": ["wallet1...", "wallet2..."],
  "input_token": "{mint}",
  "output_token": "So11111111111111111111111111111111111111112",
  "input_amount": {
    "wallet1...": "1000000",
    "wallet2...": "1000000"
  },
  "slippage": 0.05,
  "is_anti_mev": true,
  "priority_fee": "100000"
}
```

---

## 2. GMGN Security — جایگزین GoPlus

> **GoPlus حذف شد.** تمام Security Check از `GET /v1/token/security` + scoring داخلی.

### 2.1 Security Response Fields

#### Contract Safety


| Field                      | Chains   | Safe Value             |
| -------------------------- | -------- | ---------------------- |
| `is_honeypot`              | BSC/Base | `"no"`                 |
| `open_source`              | all      | `"yes"`                |
| `owner_renounced`          | all      | `"yes"`                |
| `renounced_mint`           | SOL      | `true`                 |
| `renounced_freeze_account` | SOL      | `true`                 |
| `buy_tax` / `sell_tax`     | all      | `0` (ratio: 0.03 = 3%) |


#### Holder & Trading Risk


| Field                  | Safe            | Warning   | Danger         |
| ---------------------- | --------------- | --------- | -------------- |
| `rug_ratio`            | < 0.10          | 0.10–0.30 | > 0.30         |
| `top_10_holder_rate`   | < 0.20          | 0.20–0.50 | > 0.50         |
| `creator_token_status` | `creator_close` | —         | `creator_hold` |
| `sniper_count`         | < 5             | 5–20      | > 20           |
| `is_wash_trading`      | `false`         | —         | `true`         |
| `burn_status`          | `"burn"`        | —         | `""`           |


### 2.2 Score Calculation (0–100) — NestJS

**Implementation:** `GmgnSecurityScorer` (`src/integrations/gmgn/gmgn-security.scorer.ts`)

```typescript
// Used by SecurityCheckService via scorer.evaluate()
computeSecurityScore(security: GmgnSecurityFields, info?: GmgnTokenInfoFields, chain?: GmgnChain): number {
  if (security.is_honeypot === 'yes') return 0;

  let score = 100;
  const isSol = chain === 'sol';
  const penalties: [boolean, number][] = [
    [security.open_source !== 'yes', 15],
    [security.owner_renounced !== 'yes', 20],
    [isSol && security.renounced_mint !== true, 25],
    [isSol && security.renounced_freeze_account !== true, 25],
    [(security.rug_ratio ?? 0) > 0.3, 40],
    [(security.rug_ratio ?? 0) > 0.1, 15],
    [(security.top_10_holder_rate ?? 0) > 0.5, 25],
    [(security.top_10_holder_rate ?? 0) > 0.2, 10],
    [security.creator_token_status === 'creator_hold', 15],
    [(security.buy_tax ?? 0) > 0.1, 20],
    [(security.sell_tax ?? 0) > 0.1, 20],
    [(security.sniper_count ?? 0) > 20, 15],
    [security.is_wash_trading === true, 20],
    [(info?.wallet_tags_stat?.smart_wallets ?? 0) === 0, 5],
  ];
  for (const [condition, penalty] of penalties) {
    if (condition) score -= penalty;
  }
  return Math.max(0, Math.min(100, score));
}
```

`collectRisks()` → structured `GmgnSecurityRisk[]` برای persist در `SecurityReport.risks`.

### 2.3 Gate Logic (Core Trigger — Step 4, **قبل از FUNDING**)

```
1. resolveGateCheckAddress(network, launchpad)
     └── GMGN getTrendingSwaps → pickBenchmarkAddress (same launchpad filter)
2. checkToken(benchmark) — withSecurityCheckRetries (3× backoff)
     ├── GET /v1/token/security
     └── GET /v1/token/info (parallel)
3. GmgnSecurityScorer.evaluate() → score + isSafe + risks
4. ensurePlannedToken (address = pending:{cycleId} if new)
5. IF is_honeypot OR score < securityMinScore → persistReport + FAILED
6. ELSE → persistReport (check_address in DB) → proceed to FUNDING
```

| نکته production | جزئیات |
|-----------------|--------|
| Benchmark ≠ token ما | آدرس نمونه live از trending — نه trend package name |
| Stale cache | Redis 300s · `isSecurityReportStale(3600s)` → refresh |
| Failed gate audit | SecurityReport persist حتی روی FAIL |
| Retry | `security-retry.util` — GMGN 5xx/429 |

### 2.4 Cache

- Redis key: `gmgn:security:{chain}:{address}` — TTL **300s** (`REDIS_TTL.gmgnSecurity`)
- `RedisService.cacheGmgnSecurity` / `getCachedGmgnSecurity`
- Invalidated indirectly when settings PATCH (integrations cache invalidator)

---

## 3. ChangeNOW API — فلو کامل Funding

### 3.1 Overview


| مشخصه         | مقدار                                                            |
| ------------- | ---------------------------------------------------------------- |
| Base URL v1   | `https://api.changenow.io/v1`                                    |
| Base URL v2   | `https://api.changenow.io/v2`                                    |
| Auth Header   | `x-changenow-api-key: {API_KEY}`                                 |
| Model         | Non-custodial — user sends deposit, CN swaps, sends to `address` |
| Assets        | 1500+ coins, 2.25M+ pairs                                        |
| NestJS Client | `ChangeNowClient`                                                |


**API Key:** Register at [changenow.io/for-partners](https://changenow.io/for-partners) → Dashboard → Profile → Account details.

### 3.2 Standard Flow (v1 — پیش‌فرض)

```
Step 1: GET  /v1/currencies              → لیست ارزهای فعال
Step 2: GET  /v1/exchange/estimate       → تخمین مقدار خروجی
Step 3: POST /v1/exchange                → ایجاد تراکنش
Step 4: SEND deposit                     → Main Fee Wallet → payinAddress
Step 5: GET  /v1/transactions/{id}      → poll status تا finished
Step 6: RECEIVE                          → SOL/BNB در address مقصد (market wallet)
```

#### Step 1 — Available Currencies

```http
GET https://api.changenow.io/v1/currencies?active=true&fixedRate=false
x-changenow-api-key: {key}
```

#### Step 2 — Estimate

```http
GET https://api.changenow.io/v1/exchange/estimate?fromCurrency=usdc&toCurrency=sol&fromAmount=50&fromNetwork=eth&toNetwork=sol
x-changenow-api-key: {key}
```

**Response fields:** `estimatedAmount`, `transactionSpeedForecast`, `warningMessage`

#### Step 3 — Create Exchange

```http
POST https://api.changenow.io/v1/exchange
Content-Type: application/json
x-changenow-api-key: {key}

{
  "fromCurrency": "usdc",
  "toCurrency": "sol",
  "fromNetwork": "eth",
  "toNetwork": "sol",
  "fromAmount": "50",
  "address": "{market_wallet_solana_address}",
  "flow": "standard",
  "type": "direct",
  "refundAddress": "{main_fee_wallet_eth_address}"
}
```

**Response fields:**


| Field                     | Description                                                              |
| ------------------------- | ------------------------------------------------------------------------ |
| `id`                      | Transaction ID — for polling                                             |
| `payinAddress`            | آدرسی که USDC/ETH بفرستیم                                                |
| `payinExtraId`            | Memo/tag (if required)                                                   |
| `payoutAddress`           | مقصد نهایی (= address در request)                                        |
| `fromAmount` / `toAmount` | مبالغ                                                                    |
| `status`                  | `new` → `waiting` → `confirming` → `exchanging` → `sending` → `finished` |


#### Step 4 — Poll Status

```http
GET https://api.changenow.io/v1/transactions/{id}
x-changenow-api-key: {key}
```

**Status lifecycle:**

```
new → waiting → confirming → exchanging → sending → finished
                                              ↘ failed / refunded / expired
```


| Status       | Action                               |
| ------------ | ------------------------------------ |
| `waiting`    | Deposit not yet received — wait      |
| `confirming` | Deposit seen, awaiting confirmations |
| `exchanging` | Swap in progress                     |
| `sending`    | Sending to payout address            |
| `finished`   | ✅ Complete — wallet funded           |
| `failed`     | Retry or refund via support          |
| `expired`    | Re-create exchange                   |


### 3.3 Standard Flow (v2 — recommended for production)

> v2 endpoints may need activation by BD manager: `v2/exchange`, `validate`, `markets`, `push`, `refunds`.

#### List Currencies (v2)

```http
GET https://api.changenow.io/v2/exchange/currencies?active=true&flow=standard
x-changenow-api-key: {key}
```

#### Estimated Amount (v2)

```http
GET https://api.changenow.io/v2/exchange/estimated-amount?fromCurrency=usdc&toCurrency=sol&fromAmount=50&fromNetwork=eth&toNetwork=sol&flow=standard&type=direct
x-changenow-api-key: {key}
```

#### Create Exchange (v2)

```http
POST https://api.changenow.io/v2/exchange
Content-Type: application/json
x-changenow-api-key: {key}

{
  "fromCurrency": "usdc",
  "toCurrency": "sol",
  "fromNetwork": "eth",
  "toNetwork": "sol",
  "fromAmount": "0.05",
  "address": "{destination_wallet}",
  "refundAddress": "{main_fee_wallet}",
  "flow": "standard",
  "type": "direct"
}
```

#### Get by ID (v2)

```http
GET https://api.changenow.io/v2/exchange/by-id/{id}
x-changenow-api-key: {key}
```

#### Troubleshooting Endpoints (v2)


| Endpoint                     | Use                          |
| ---------------------------- | ---------------------------- |
| `POST /v2/exchange/continue` | Resume stuck transaction     |
| `POST /v2/exchange/refund`   | Refund to refundAddress      |
| `GET /v2/validate/address`   | Validate destination address |


### 3.4 Fixed Rate Flow (optional)


| Feature    | Detail                                    |
| ---------- | ----------------------------------------- |
| Rate lock  | 20 minutes                                |
| Activation | Contact BD manager                        |
| Endpoints  | `fixed-rate`, `v2/exchange` with `rateId` |
| Use case   | Large funding batches — price certainty   |


### 3.5 Our Funding Pipeline (NestJS — Production)

```
POST /main-fee-wallet/fund { cycleId, walletIds[], sourceAsset }
        │
        ▼
MainFeeWalletService.queueFundingJobs → BullMQ wallet-funding (concurrency 20)
        │
        ▼
FundingProcessor (per wallet):
  1. ChangeNowFundingService.fundWallet()
       ├── resolveFundingPair(USDC|ETH, SOLANA|BSC) from runtime.fundingPairs
       ├── POST /v2/exchange (default apiVersion v2)
       ├── getRefundAddress() — MUST match mainFeeWalletEvmPrivateKey
       ├── sendDeposit() — USDC ERC20 transfer or ETH via EthereumRpcClient
       └── pollExchangeUntilTerminal() — interval pollIntervalMs, max pollTimeoutMs
  2. On finished → FundingTransaction COMPLETED + MainWalletLedger OUT (idempotent)
  3. On failed/expired → FAILED + failureReason · retry per exchangeRetryAttempts
        │
        ▼
CoreTrigger FundingGateService.pollUntilSettled(cycleId)
  └── ALL COMPLETED required before TOKEN_LAUNCH
```

| Runtime key | Default | نقش |
|-------------|---------|-----|
| `pollIntervalMs` | 10000 | فاصله poll status |
| `pollTimeoutMs` | 900000 (15 min) | timeout per exchange |
| `fundingConcurrency` | 20 | parallel BullMQ jobs |
| `exchangeRetryAttempts` | 3 | re-create exchange on fail |
| `depositRetryAttempts` | 3 | re-send USDC/ETH to payin |
| `usdcEthereumContract` | `0xA0b8...` | USDC mainnet transfer |

**Pairs (settings `runtime.changeNow.fundingPairs`):**

| Key | From → To |
|-----|-----------|
| `USDC:SOLANA` | usdc@eth → sol@sol |
| `USDC:BSC` | usdc@eth → bnb@bsc |
| `ETH:SOLANA` | eth@eth → sol@sol |
| `ETH:BSC` | eth@eth → bnb@bsc |

**Typed errors:** `ChangeNowConfigurationError` · `ChangeNowTimeoutError` · `ChangeNowValidationError`

**Terminal statuses:** `finished` = success · `failed`/`expired`/`refunded` = terminal fail

### 3.4 ChangeNOW — فی، حداقل، اقتصاد per چرخه (v3)

> جزئیات مالی کامل: [`cost-model.md`](./cost-model.md) § ChangeNOW

#### کارمزد swap

| مورد | مقدار |
|------|-------|
| Fee embedded در نرخ | ~**0.25% – 1%** per order (typical **~0.5%**) |
| ۲۰۱ سفارش @ ~$2.3 | ~**$2 – $8** burn per cycle |

#### حداقل تبدیل (dynamic)

ChangeNOW **min ثابت ندارد** — per pair · per moment از API:

```http
GET https://api.changenow.io/v2/exchange/min-amount?fromCurrency=usdc&toCurrency=sol&fromNetwork=eth&toNetwork=sol&flow=standard&type=direct
x-changenow-api-key: {key}
```

| pair | typical min | بازه |
|------|-------------|------|
| USDC@ETH → SOL | ~$2 | $1.7 – $20 |
| USDC@ETH → BNB | ~$3–5 | $1.7 – $20 |

**کد (`changenow-funding.service.ts`):**

```
estimate fail → getMinAmountV2()
if amountUsd < minAmount → ChangeNowValidationError → FundingTransaction FAILED
```

| setting | v3 production | ریسک |
|---------|---------------|------|
| `minTradeAmountUsd` | $2 | نزدیک کف ChangeNOW |
| `amountPerWalletUsd` واقعی | ~$2.2–2.5 | از `computeOwnerLaunchFundingUsd` |

#### ETH gas — هزینه جدا از fee ChangeNOW

هر funding = **۱ USDC ERC20 transfer** روی Ethereum mainnet به `payinAddress`:

| | مقدار |
|--|--------|
| سفارش per cycle | **۲۰۱** (owner + 200 market) |
| gas per transfer | ~$0.40 – $2.50 |
| **کل burn ETH** | ~**$80 – $350** typical |

**بدون ETH کافی روی Ethereum → deposit fail → `waiting`/`expired`.**

#### جمع per چرخه (Solana production)

| line | USD | burn? |
|------|-----|-------|
| اصل USDC→SOL (۲۰۱×~$2.3) | ~$455 | ❌ می‌چرخد |
| ChangeNOW fee | ~$2–8 | ✅ |
| ETH deposit gas | ~$80–350 | ✅ |

**Pairs + pipeline:** §3.5 زیر

---

## 4. Pump.fun

### 4.1 Architecture — دو لایه


| Layer                    | Method                        | Use                                           |
| ------------------------ | ----------------------------- | --------------------------------------------- |
| **A — Frontend API v3**  | REST + JWT                    | Create coin metadata + get bonding curve info |
| **B — On-chain Program** | `@pump-fun/sdk` or PumpPortal | Build + sign + send TX (create, buy, sell)    |


> Pump.fun **REST API رسمی** برای create دارد؛ buy/sell از طریق **serialized transaction** (PumpPortal یا SDK on-chain).

### 4.2 Frontend API v3 — Create Coin

```http
POST https://frontend-api-v3.pump.fun/coins/create
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "name": "My Token",
  "symbol": "MTKN",
  "description": "Viral meme coin",
  "twitter": "@handle",
  "telegram": "https://t.me/group",
  "website": "https://example.com",
  "showName": true,
  "file": "{base64_png_optional}"
}
```

**Response:**

```json
{
  "mint": "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",
  "metadata_uri": "https://cf-ipfs.com/ipfs/Qm...",
  "bonding_curve": "...",
  "associated_bonding_curve": "...",
  "signature": "5wZ8..."
}
```

**Image requirements:** PNG/JPG/GIF, base64, min 512×512, max 2MB.

**Bonding curve:** Auto-created on launch. Token **graduates to Raydium** when curve completes (~$69K MC).

### 4.3 On-Chain — Create (SDK — recommended for NestJS)

```typescript
import { PUMP_SDK } from '@pump-fun/pump-sdk';

// ALWAYS use createV2Instruction — createInstruction is DEPRECATED
const createIx = await PUMP_SDK.createV2Instruction({
  mint: mintKeypair.publicKey,
  name: trendPackage.name,
  symbol: trendPackage.symbol,
  uri: metadataUri,        // IPFS upload from logo + description
  creator: ownerWallet.pubkey,
  user: ownerWallet.pubkey,
  mayhemMode: false,
});
// Sign + send via SolanaRpcClient
```

**Metadata upload:** Upload JSON `{name, symbol, description, image}` to IPFS/Arweave → pass `uri`.

### 4.4 Buy / Sell / Create — PumpPortal **Local** Trading API

> **مهم — دو مدل PumpPortal:**
>
> | API | Endpoint | کلید | ولت |
> |-----|----------|------|-----|
> | **Lightning** | `POST /api/trade?api-key=...` | API key از سایت = **یک ولت** (private key داخل key رمزشده) | فقط همان ولت — PumpPortal امضا می‌کند |
> | **Local** (ما) | `POST /api/trade-local` | **اختیاری** — docs رسمی بدون key | **هر** `publicKey` در body — شما با KMS امضا می‌کنید |
>
> پلتفرم ما **فقط Local** است: owner + ~۲۰۰ market wallet هر کدام `publicKey` خودشان را می‌فرستند.
> کلیدی که از pumpportal.fun می‌سازی برای **Lightning wallet** است — برای multi-wallet **لازم نیست** بگذاری در settings (یا خالی بگذار).
> `pumpFunJwtToken` هم JWT session یک اکانت pump.fun است — در flow فعلی **استفاده نمی‌شود** (`createCoin` صدا زده نمی‌شود؛ metadata از `data:application/json;base64,...` ساخته می‌شود).

> Third-party tx builder. Fee: ~0.5% per trade (on-chain). API key on Local path is optional per official docs.

```http
POST https://pumpportal.fun/api/trade-local
Content-Type: application/json
# Authorization: Bearer ...  ← اختیاری؛ کلید سایت = Lightning wallet، نه «master key» برای همه ولت‌ها

{
  "publicKey": "{wallet_pubkey}",
  "action": "buy",
  "mint": "{token_mint}",
  "amount": 0.01,
  "denominatedInSol": "true",
  "slippage": 5,
  "priorityFee": 0.0001,
  "pool": "pump"
}
```

**Sell 100% (Emergency Brake):**

```json
{
  "publicKey": "{wallet_pubkey}",
  "action": "sell",
  "mint": "{token_mint}",
  "amount": "100%",
  "denominatedInSol": "false",
  "slippage": 25,
  "priorityFee": 0.001,
  "pool": "pump"
}
```

**NestJS flow:**

```typescript
const txBytes = await pumpPortal.tradeLocal(params);
const tx = VersionedTransaction.deserialize(new Uint8Array(txBytes));
tx.sign([walletKeypair]);
const sig = await solanaRpc.sendTransaction(tx);
```

**WebSocket (real-time):** `wss://pumpportal.fun/api/data`

- `subscribeNewToken` — new launches
- `subscribeTokenTrade` — trades on mint
- `subscribeAccountTrade` — trades by wallet

### 4.5 Buy / Sell — On-Chain SDK

```typescript
const buyIxs = await sdk.buyInstructions({
  global, bondingCurve, associatedUserAccountInfo, mint, user,
  amount: expectedTokens,
  solAmount: maxSolCost,
  slippage: 0.05,
});
// sellInstructions() for sell
```

**Pricing helpers:**

- `getBuyTokenAmountFromSolAmount()` — tokens for SOL
- `getSellSolAmountFromTokenAmount()` — SOL for tokens
- `bondingCurveMarketCap()` — current MC in lamports

### 4.6 Jito Bundle (High-speed Market Making — 100 trades/min)

```http
POST https://pumpportal.fun/api/trade-bundle
```

- Multiple wallets buy/sell atomically in one block
- Params: `accounts[]`, `action`, `mint`, `amount`, `slippage`, `jitoTip`
- Use for initial burst: 50 wallets buy in same block

### 4.7 NestJS PumpFunClient Methods


| Method                      | Implementation                      |
| --------------------------- | ----------------------------------- |
| `uploadMetadata()`          | IPFS → uri                          |
| `createToken()`             | createV2Instruction + RPC send      |
| `buy()`                     | trade-local or buyInstructions      |
| `sell()`                    | trade-local or sellInstructions     |
| `sellAll()`                 | amount: "100%"                      |
| `getCoin()`                 | GET frontend-api-v3 `/coins/{mint}` |
| `getBondingCurveProgress()` | SDK bondingCurve state              |

### 4.8 Production path (token-platform)

| Operation | Primary implementation | Verify |
|-----------|------------------------|--------|
| Create | `PumpFunSdkService.createToken` — createV2Instruction + IPFS metadata | `SolanaRpcClient.hasConfirmedTransaction` |
| Buy/Sell | `PumpFunSdkService` on-chain instructions (NOT simulate) | RPC confirm before Trade DB |
| Alternative | `PumpPortalClient.tradeLocal` — if SDK path unavailable | same verify |
| Health | `PumpPortalClient.healthCheck` — HTTP probe only | degraded OK if SDK works |

**Redis crash recovery:** `token:launch:pending:{cycleId}` — resume without duplicate mint.

## 5. FourMeme

### 5.1 Architecture — API + On-Chain


| Layer              | Base                            | Use                          |
| ------------------ | ------------------------------- | ---------------------------- |
| **REST API**       | `https://four.meme/meme-api/v1` | Auth, upload, create args    |
| **Smart Contract** | BSC TokenManager2               | On-chain create + buy + sell |


**Contract addresses (BSC):**


| Contract            | Address                                      |
| ------------------- | -------------------------------------------- |
| TokenManager2 (V2)  | `0x5c952063c7fc8610FFDB798152D69F0B9550762b` |
| TokenManagerHelper3 | Query via `getTokenInfo(token)`              |


> **V1 not supported.** Only TokenManager2 (V2).

### 5.2 Create Token — Full Flow

```
Step 1: POST /private/user/nonce/generate
Step 2: POST /private/user/login/dex        → access_token
Step 3: POST /private/token/upload          → imgUrl
Step 4: GET  /public/config                 → raisedToken (DO NOT MODIFY)
Step 5: POST /private/token/create          → createArg, signature
Step 6: ON-CHAIN TokenManager2.createToken(createArg, signature)
```

#### Step 1 — Nonce

```http
POST https://four.meme/meme-api/v1/private/user/nonce/generate
Content-Type: application/json

{ "accountAddress": "0x...", "verifyType": "LOGIN", "networkCode": "BSC" }
```

Response: `{ "code": "0", "data": "{nonce}" }`

#### Step 2 — Login

```http
POST https://four.meme/meme-api/v1/private/user/login/dex

{
  "verifyInfo": {
    "signature": "{sign('You are sign in Meme {nonce}')}",
    "address": "0x...",
    "networkCode": "BSC",
    "verifyType": "LOGIN"
  },
  "region": "EN",
  "langType": "EN",
  "walletName": "platform"
}
```

Response: `{ "code": "0", "data": "{access_token}" }`

#### Step 3 — Upload Image

```http
POST https://four.meme/meme-api/v1/private/token/upload
meme-web-access: {access_token}
Content-Type: multipart/form-data

file: {logo.png}
```

Formats: jpeg, png, gif, bmp, webp

#### Step 4 — Public Config

```http
GET https://four.meme/meme-api/v1/public/config
```

Copy `raisedToken` object exactly — **do not modify**.

#### Step 5 — Create (API)

```http
POST https://four.meme/meme-api/v1/private/token/create
meme-web-access: {access_token}
Content-Type: application/json

{
  "name": "Token Name",
  "shortName": "TKN",
  "desc": "Description",
  "imgUrl": "{from step 3}",
  "label": "Meme",
  "raisedAmount": 24,
  "raisedToken": "{from step 4 — unchanged}",
  "launchTime": 0,
  "lpTradingFee": 0.0025,
  "preSale": "0",
  "feePlan": false
}
```

**Labels:** Meme, AI, Defi, Games, Infra, De-Sci, Social, Depin, Charity, Others

Response: `{ "code": "0", "data": { "createArg": "0x...", "signature": "0x..." } }`

#### Step 6 — Create (On-Chain)

```typescript
const tx = await tokenManager2.createToken(createArg, signature, {
  value: creationFeeWei,  // from API response hint
});
await tx.wait();
```

### 5.3 Buy — On-Chain (TokenManager2)

**By token amount:**

```solidity
buyToken(token, amount, maxFunds)
// Spend at most maxFunds BNB to buy `amount` tokens
```

**By BNB spend (AMAP — As Much As Possible):**

```solidity
buyTokenAMAP(token, funds, minAmount)
// Spend `funds` BNB, receive at least minAmount tokens
```

**NestJS:**

```typescript
// Quote first (read-only via Helper3)
const quote = await helper3.tryBuy(token, amount, funds);

// Execute
if (isBEP20Quote) await token.approve(tokenManager2, amount);
await tokenManager2.buyTokenAMAP(token, fundsWei, minAmountWei);
```

### 5.4 Sell — On-Chain

```typescript
await token.approve(tokenManager2.address, amount);
await tokenManager2.sellToken(token, amount);
// With slippage: sellToken(origin, token, amount, minFunds)
```

**Emergency sell all:**

```typescript
const balance = await token.balanceOf(wallet.address);
await token.approve(tokenManager2.address, balance);
await tokenManager2.sellToken(token, balance, minFundsWei);
```

### 5.5 Events (Copy-trading / Monitoring)


| Event            | Args                                | Use                 |
| ---------------- | ----------------------------------- | ------------------- |
| `TokenCreate`    | creator, token, name, symbol        | New token detection |
| `TokenPurchase`  | token, account, price, amount, cost | Buy tracking        |
| `TokenSale`      | token, account, price, amount, cost | Sell tracking       |
| `LiquidityAdded` | base, offers, quote, funds          | Graduation to DEX   |


Listen via `eth_getLogs` on TokenManager2 address.

### 5.6 NestJS FourMemeClient Methods


| Method           | Steps                                               |
| ---------------- | --------------------------------------------------- |
| `authenticate()` | nonce → login → cache access_token (Redis 23h)      |
| `uploadImage()`  | POST /private/token/upload                          |
| `createToken()`  | upload → config → create API → createToken on-chain |
| `quoteBuy()`     | Helper3 tryBuy (read-only)                          |
| `quoteSell()`    | Helper3 trySell (read-only)                         |
| `buy()`          | approve (if BEP20) → buyToken/buyTokenAMAP          |
| `sell()`         | approve → sellToken                                 |
| `getTokenInfo()` | Helper3 getTokenInfo → version, price, offers       |

### 5.7 Production path (token-platform)

| Operation | Implementation | Verify |
|-----------|----------------|--------|
| Auth | `FourMemeApiClient.authenticate` — Redis `fourmeme:access:{address}` ~23h | — |
| Create | API createArg → `FourMemeChainService.createToken` on-chain | `BscRpcClient.hasSuccessfulTransaction` |
| Buy/Sell | `FourMemeChainService.buy` / `sell` — Helper3 quote first | RPC receipt |
| Emergency | sell 100% balance + minFunds slippage guard | same |

---

## 6. LetsBonk

### 6.1 Architecture — Raydium LaunchLab (On-Chain)


| مشخصه               | مقدار                                          |
| ------------------- | ---------------------------------------------- |
| Platform            | LetsBonk.fun (BONK community + Raydium)        |
| Underlying Protocol | **Raydium LaunchLab**                          |
| Program ID          | `LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj`  |
| Platform Config     | `FfYek5vEz23cMkWsdJwG2oa6EphsvXSHrGpdALN4g6W1` |
| NestJS Client       | `LetsBonkClient` (wraps Raydium LaunchLab SDK) |
| REST API            | **ندارد** — فقط on-chain + third-party         |


> LetsBonk UI = Raydium LaunchLab با platform config اختصاصی BONK.  
> Token بعد از bonding curve → Raydium pool + Jupiter routing.

### 6.2 Create Token — Raydium LaunchLab SDK

```typescript
import { Raydium, TxVersion } from '@raydium-io/raydium-sdk-v2';

// Initialize with platform config for LetsBonk
const { execute } = await raydium.launchpad.createLaunchpad({
  programId: LAUNCHLAB_PROGRAM_ID,
  platformId: LETSBONK_PLATFORM_CONFIG,
  mintA: mintKeypair.publicKey,
  decimals: 6,
  name: trendPackage.name,
  symbol: trendPackage.symbol,
  uri: metadataUri,
  migrateType: 'amm',          // graduate to Raydium AMM
  configId: launchpadConfigId,
  // dev buy optional:
  buyAmount: devBuyLamports,
});
const { txIds } = await execute({ sendAndConfirm: true });
```

**Metadata:** Upload `{name, symbol, description, image}` to IPFS → `uri`.

### 6.3 Buy / Sell — LaunchLab Bonding Curve

```typescript
// Buy on bonding curve
const { execute } = await raydium.launchpad.buyToken({
  mintA: tokenMint,
  buyAmount: solAmount,
  slippage: new BN(500), // 5% in bps
});

// Sell on bonding curve
const { execute } = await raydium.launchpad.sellToken({
  mintA: tokenMint,
  sellAmount: tokenAmount,
  slippage: new BN(2500), // 25% emergency
});
```

**Alternative SDK:** `@solana-launchpad/sdk`

```typescript
import { makeBuyIx, makeSellIx } from '@solana-launchpad/sdk';
const buyIxs = await makeBuyIx(connection, wallet, amount, creator, mint);
```

### 6.4 Graduation Detection

```
Bonding curve complete → token listed on Raydium AMM
→ pool exchange becomes "raydium" in GMGN pool_info
→ is_on_curve = false in GMGN holders response
```

Monitor via:

- GMGN `GET /v1/token/pool_info` — exchange changes from launchpad to raydium
- Bitquery/Shyft gRPC — LaunchLab program transactions

### 6.5 High-Speed Market Making on LetsBonk

Same pattern as Pump.fun:

1. Generate 100–200 wallets
2. Fund via ChangeNOW (USDC → SOL)
3. Parallel `buyToken` via Raydium SDK or GMGN `multiSwap`
4. Alternate buy/sell between wallets
5. GMGN `GET /v1/token/info` for MC/volume polling

### 6.6 NestJS LetsBonkClient Methods


| Method                  | Implementation                     |
| ----------------------- | ---------------------------------- |
| `createToken()`         | Raydium launchpad.createLaunchpad  |
| `buy()`                 | launchpad.buyToken                 |
| `sell()`                | launchpad.sellToken                |
| `sellAll()`             | sell full balance                  |
| `getPoolInfo()`         | GMGN /v1/token/pool_info           |
| `getGraduationStatus()` | check is_on_curve via GMGN holders |

### 6.7 Production path (token-platform)

| Operation | Implementation | Verify |
|-----------|----------------|--------|
| Create | `LetsBonkSdkService.createToken` — Raydium LaunchLab | Solana RPC confirm |
| Buy/Sell | LaunchLab SDK instructions | `hasConfirmedTransaction` |
| Fallback swap | PumpPortal `trade-local` + KMS sign | RPC confirm |

---

## 7. NestJS Client Map

```
src/integrations/
├── integrations.module.ts              # Root — exports all integration modules
├── integrations-config.service.ts      # Deep-merge DB + docs/settings.defaults.json
├── integrations-config.module.ts       # @Global()
├── integrations-config.validator.ts    # validateMergedIntegrations · QuickNode URL rules
├── integrations-cache-invalidator.service.ts  # Invalidate RPC/GMGN cache on PATCH
├── integrations-health.service.ts      # 13 provider probes
├── integrations-health.controller.ts   # GET /integrations/health
├── integrations-probe.util.ts          # PROBE_TIMEOUT_MS=12s · placeholder detection
├── common/integration-http.util.ts     # Shared HTTP helpers
│
├── gmgn/
│   ├── gmgn.client.ts                  # 27 OpenAPI methods · rate-limit retry
│   ├── gmgn-auth.service.ts            # Normal + Critical Ed25519/RSA signing
│   ├── gmgn-security.scorer.ts         # Score 0-100 + collectRisks()
│   ├── gmgn-query.util.ts              # timestamp + client_id on every request
│   ├── gmgn-swap.util.ts               # extractGmgnSwapTxId from swap response
│   └── gmgn.errors.ts                  # GmgnRateLimitError · GmgnApiError
│
├── changenow/
│   ├── changenow.client.ts             # v1 + v2 exchange · currencies · poll
│   ├── changenow-funding.service.ts    # fundWallet · fundBatch · deposit · poll
│   ├── changenow.util.ts               # Status mapping helpers
│   └── changenow.errors.ts
│
├── pump-fun/
│   ├── pump-fun-api.client.ts          # Frontend API v3 (optional metadata)
│   ├── pump-portal.client.ts           # trade-local · health probe
│   ├── pump-fun-sdk.service.ts         # On-chain createV2 + buy/sell (production path)
│   └── pump-fun.errors.ts
│
├── four-meme/
│   ├── four-meme-api.client.ts         # Auth · upload · createArg (Redis token 23h)
│   ├── four-meme-chain.service.ts      # TokenManager2 buy/sell on BSC
│   └── four-meme.constants.ts          # TokenManager2 address
│
├── letsbonk/
│   └── letsbonk-sdk.service.ts         # Raydium LaunchLab via PumpPortal (create + trade on-chain)
│
├── openai/
│   ├── openai.client.ts                # chatCompletion · imageGeneration · healthCheck
│   └── openai.errors.ts
│
├── dexscreener/
│   └── dexscreener.client.ts           # getTokenPairs · native SOL price
│
├── pricing/
│   ├── native-token-price.service.ts   # GMGN + DexScreener + ChangeNOW median
│   ├── native-token-price.controller.ts  # GET/POST /integrations/native-prices
│   └── native-token-price.errors.ts
│
├── solana-rpc/
│   └── solana-rpc.client.ts            # Connection cache · hasConfirmedTransaction
├── bsc-rpc/
│   └── bsc-rpc.client.ts               # ethers Provider · hasSuccessfulTransaction
├── ethereum-rpc/
│   └── ethereum-rpc.client.ts          # ChangeNOW USDC deposit · mainnet
│
├── rpc/
│   ├── rpc-health.controller.ts        # GET /integrations/rpc/health
│   ├── quicknode.util.ts               # assertQuickNodeHttpUrl · WS pair validation
│   └── rpc.errors.ts
│
├── etherscan/
│   ├── etherscan.client.ts             # v2 multi-chain · gas oracle health
│   └── etherscan.errors.ts             # EtherscanRateLimitError
│
└── solana-scan/
    └── solana-scan.client.ts           # Solscan Pro API v2
```

### Module consumers (who calls what)

| Consumer module | Integrations used |
|---------------|-------------------|
| `main-fee-wallet` | ChangeNOW · EthereumRpc · NativeTokenPrice |
| `core-trigger` | (via processors) all launch/funding/security |
| `security-check` | GMGN security + info · Redis cache |
| `token-factory` | PumpFun · LetsBonk · FourMeme · Solana/Bsc RPC |
| `market-generator` | Trade SDKs · RPC verify · WalletGenerator balance |
| `profit-extractor` | GMGN supply · launchpad RPC · sell SDKs |
| `emergency` | Sell SDKs · RPC verify · Bsc/Solana RPC |
| `treasury-*` | Sell · sweep · RPC · ChangeNOW (optional convert) |
| `trend-finder` | OpenAI · GMGN symbol check |
| `token-info` | GMGN getTokenInfo · DexScreener |
| `liquidity-analyzer` | GMGN getTokenPoolInfo |
| `visibility-orchestrator` | DexScreener · GMGN |
| `wallet-generator` | SolanaRpc · BscRpc · NativeTokenPrice |

### Settings — منبع واحد (نه .env)

> Seed: `docs/settings.defaults.json` | ویرایش: `PATCH /api/v1/settings`  
> **هیچ مقدار runtime در کد hardcode نیست** — همه از `integrations.endpoints` + `integrations.runtime` خوانده می‌شوند و با فایل defaults ادغام می‌شوند.

```json
{
  "integrations": {
    "openaiApiKey": "sk-demo-...",
    "gmgnApiKey": "gmgn_demo_...",
    "gmgnPrivateKey": "",
    "changeNowApiKey": "changenow_demo_...",
    "pumpPortalApiKey": "",
    "solanaRpcUrl": "https://api.mainnet-beta.solana.com",
    "evmRpcUrl": "https://bsc-dataseed.binance.org",
    "etherscanApiKey": "one-key-all-evm-v2",
    "solanaScanApiKey": "solscan_demo_...",
    "endpoints": {
      "gmgnBaseUrl": "https://openapi.gmgn.ai",
      "changeNowBaseUrlV1": "https://api.changenow.io/v1",
      "changeNowBaseUrlV2": "https://api.changenow.io/v2",
      "pumpFunApiV3Url": "https://frontend-api-v3.pump.fun",
      "pumpPortalApiUrl": "https://pumpportal.fun/api",
      "fourMemeApiUrl": "https://four.meme/meme-api/v1",
      "openaiBaseUrl": "https://api.openai.com/v1",
      "dexScreenerBaseUrl": "https://api.dexscreener.com",
      "dexScreenerBoostsUrl": "https://api.dexscreener.com/token-boosts/top/v1",
      "etherscanBaseUrl": "https://api.etherscan.io/v2/api",
      "solanaScanBaseUrl": "https://pro-api.solscan.io/v2.0"
    },
    "runtime": {
      "gmgn": { "defaultTimeoutMs": 10000, "criticalTimeoutMs": 30000, "rateLimitMaxWaitMs": 30000, "httpRetries": 3 },
      "changeNow": { "pollIntervalMs": 10000, "pollTimeoutMs": 900000, "fundingConcurrency": 20, "fundingPairs": { "...": "..." } },
      "pumpFun": { "slippagePercent": 5, "devBuySol": 0.01 },
      "fourMeme": { "tokenManagerV2Address": "0x5c95...", "creationFeeBnb": "0.01", "accessTokenCacheSeconds": 82800 },
      "letsBonk": { "wrappedSolMint": "So111...", "slippageBps": 500, "defaultBuySol": 0.01 },
      "openai": {
        "chatTimeoutMs": 60000,
        "imageTimeoutMs": 120000,
        "imageModel": "gpt-image-2",
        "imageSize": "1024x1024",
        "imageQuality": "high",
        "imageOutputFormat": "png",
        "temperature": 0.9
      },
      "trade": {
        "priceCacheSeconds": 60,
        "providerPriority": ["gmgn", "dexscreener", "changenow"]
      },
      "explorer": { "defaultBscChainId": 56, "solanaScanDefaultLimit": 20 }
    }
  },
  "proxy": { "enabled": false, "url": "socks5://user:pass@host:port" },
  "telegram": { "botToken": "", "chatIds": [] }
}
```

**قیمت زنده SOL/BNB:** دیگر دستی در settings وارد نمی‌شود. `NativeTokenPriceService` به‌صورت موازی از GMGN (`/token/info` روی WSOL/WBNB)، DexScreener (بیشترین liquidity) و ChangeNOW (`estimated-amount` مثل funding) می‌خواند، median می‌گیرد و در Redis cache می‌کند. اگر همه providerها fail شوند، **آخرین قیمت معتبر** از Redis (`stale-cache`) استفاده می‌شود — نه عدد ثابت. اگر آن هم منقضی شده باشد (`stalePriceMaxAgeSeconds`)، trade خطا می‌دهد.

```http
GET  /api/v1/integrations/native-prices
POST /api/v1/integrations/native-prices/refresh
```

**Etherscan v2:** یک `etherscanApiKey` — BSC با `runtime.explorer.defaultBscChainId` (پیش‌فرض 56)، بدون BscScan جدا.

### QuickNode RPC (Solana + BSC — Production)

تمام RPCهای on-chain از **QuickNode** می‌آیند. URLها را از داشبورد QuickNode کپی کن و در settings بگذار:

```json
{
  "integrations": {
    "solanaRpcUrl": "https://YOUR_NAME.solana-mainnet.quiknode.pro/YOUR_TOKEN/",
    "solanaRpcWsUrl": "",
    "evmRpcUrl": "https://YOUR_NAME.bsc.quiknode.pro/YOUR_TOKEN/",
    "ethereumRpcUrl": "https://YOUR_NAME.ethereum-mainnet.quiknode.pro/YOUR_TOKEN/"
  }
}
```

- `solanaRpcWsUrl` خالی = WSS به‌صورت خودکار از HTTP ساخته می‌شود (`https` → `wss`)
- اگر `solanaRpcWsUrl` ست شود، **host** باید با HTTP یکی باشد؛ فقط `wss://` مجاز است
- `ethereumRpcUrl` برای ChangeNOW deposit هم **QuickNode mainnet** است (`assertQuickNodeHttpUrl`)
- `runtime.solanaRpc` / `runtime.bscRpc` → commitment، retry، timeout، chainId
- Connection/Provider **cache** می‌شوند؛ با PATCH URL، cache invalidate می‌شود
- Token در URL حساس است — `GET /settings` آن را mask می‌کند

```http
GET /api/v1/integrations/rpc/health
```

پاسخ نمونه: `slot` (Solana)، `blockNumber` + `chainId: 56` (BSC)، `ethereum` با `chainId: 1`، `provider: quicknode`

---

## 8. Explorers — Etherscan v2 + Solscan

### 8.1 Etherscan API v2 (تمام EVM — یک Key)


| مشخصه        | مقدار                             |
| ------------ | --------------------------------- |
| Settings key | `integrations.etherscanApiKey`    |
| Base URL     | `https://api.etherscan.io/v2/api` |
| BSC          | `chainid=56`                      |
| Ethereum     | `chainid=1`                       |
| Base         | `chainid=8453`                    |


```http
GET https://api.etherscan.io/v2/api?chainid=56&module=account&action=txlist&address=0x...&apikey={etherscanApiKey}
```

> **BscScan API جدا لازم نیست.** از Etherscan v2 با chainid استفاده کن.

**`EtherscanClient` methods:** `getTransactions`, `getTokenTransfers`, `getInternalTransactions`, `getBalance` / `getBalanceWei`, `getTokenBalance`, `getGasOracle`, `getTransactionByHash`, `healthCheck`.

- Pagination: `runtime.explorer.txListDefaultOffset` (پیش‌فرض 100)، `txListMaxOffset` (10000)
- Empty results (`No transactions found`, `[]`) خطا نیستند؛ rate-limit → `EtherscanRateLimitError`
- Health: `GET /api/v1/integrations/health` → probe `etherscan` (gasoracle روی BSC)

### 8.2 Solscan (فقط Solana)

| مشخصه | مقدار |
|-------|-------|
| Settings key | `integrations.solanaScanApiKey` |
| Base URL | `integrations.endpoints.solanaScanBaseUrl` → `https://pro-api.solscan.io/v2.0` |
| Auth header | `token: {solanaScanApiKey}` |
| NestJS Client | `SolanaScanClient` |
| Health probe | `healthCheck()` — lightweight account request |

**Use cases در سیستم:**

| Use | Method |
|-----|--------|
| Health / integration probe | `healthCheck()` |
| TX history (optional audit) | account transactions API |
| Cross-check با RPC | `SolanaRpcClient.hasConfirmedTransaction` = primary verify |

> **Production path:** on-chain confirmation از **RPC** (`hasConfirmedTransaction`) — Solscan برای explorer/audit، نه gate اصلی trade.

---

## 9. RPC Layer — QuickNode

> **Production requirement:** `validateIntegrationConfig` rejects placeholder URLs (`YOUR_ENDPOINT`, `YOUR_QUICKNODE_TOKEN`).

### 9.1 Endpoints (Settings)

| Key | Network | Use |
|-----|---------|-----|
| `solanaRpcUrl` | Solana mainnet | create · buy · sell · balance · verify |
| `solanaRpcWsUrl` | Optional WSS | auto-derived from HTTP if empty |
| `evmRpcUrl` | BSC (chainId 56) | FourMeme · BNB balance · verify |
| `ethereumRpcUrl` | Ethereum mainnet | ChangeNOW USDC deposit · main fee |

### 9.2 Clients

| Client | Methods (production-critical) |
|--------|------------------------------|
| `SolanaRpcClient` | `getConnection` · `getBalance` · `sendTransaction` · `hasConfirmedTransaction` · `healthCheck` |
| `BscRpcClient` | `getProvider` · `getBalance` · `hasSuccessfulTransaction` · `healthCheck` |
| `EthereumRpcClient` | `getProvider` · `sendTransaction` · `waitForTransaction` · `healthCheck` |

### 9.3 Runtime (`integrations.runtime.solanaRpc` / `bscRpc`)

| Param | Typical | نقش |
|-------|---------|-----|
| `commitment` | `confirmed` | Solana finality |
| `confirmTimeoutMs` | 60000 | waitForTransaction timeout |
| `maxRetries` | 3 | RPC call retry |
| `provider` | `quicknode` | health response label |

### 9.4 Cache invalidation

- Connection/Provider cached by URL fingerprint
- `IntegrationsCacheInvalidator` on PATCH settings → `solanaRpc.invalidateConnection()` · `bscRpc.invalidateProvider()` · etc.
- Balance cache: Redis `rpc:balance:{network}:{address}` TTL 5s

### 9.5 Health endpoint

```http
GET /api/v1/integrations/rpc/health
```

| Field | Expected (production) |
|-------|----------------------|
| `solana.status` | `up` · `slot` > 0 |
| `bsc.status` | `up` · `chainId: 56` |
| `ethereum.status` | `up` · `chainId: 1` |
| placeholder URL | `degraded` — **نه hang** |

---

## 10. OpenAI — Trend Finder

| مشخصه | مقدار |
|-------|-------|
| Client | `OpenAiClient` |
| Settings | `openaiApiKey` · `openaiModel` (e.g. `gpt-4o`) |
| Runtime | `runtime.openai.chatTimeoutMs` · `temperature` · `imageModel` · `imageQuality` · `imageOutputFormat` |
| Proxy | `settings.proxy` passed to HttpClient |

| Method | API | Use |
|--------|-----|-----|
| `chatCompletion` | `POST /chat/completions` | Topic · Name/Symbol · Description prompts |
| `generateImage` | `POST /images/generations` | Logo 1:1 (GPT Image 2, `b64_json` → buffer) |
| `healthCheck` | `GET /models` | Verifies API key + configured `imageModel` availability |

**Retry (trend-finder module):** exponential backoff · `Retry-After` · rate limit 429 — تا 4 attempts.  
**Non-retryable:** `OpenAiConfigurationError` (missing key).

---

## 11. DexScreener + Native Prices

### 11.1 DexScreener

| مشخصه | مقدار |
|-------|-------|
| Base URL | `https://api.dexscreener.com` → `GET /latest/dex/tokens/{address}` |
| Auth | None (public) |
| Client | `DexScreenerClient.getTokenPairs(mint)` |

**Consumers:** `NativeTokenPriceService` · `VisibilityOrchestrator` (`DexScreenerMonitorService`) · integrations health.

### 11.2 NativeTokenPriceService — consensus pricing

```
Parallel fetch:
  1. GMGN getTokenInfo(WSOL/WBNB)
  2. DexScreener highest-liquidity pair
  3. ChangeNOW estimated-amount (same as funding math)
        │
        ▼
  Median of valid prices → Redis native:usd:prices
  Last-good fallback → native:usd:last-good:{asset}
  If all fail + stale expired → NativeTokenPriceError (blocks trade)
```

```http
GET  /api/v1/integrations/native-prices
POST /api/v1/integrations/native-prices/refresh
```

| Asset | Mint/Address used |
|-------|-------------------|
| SOL | `runtime.letsBonk.wrappedSolMint` (WSOL) |
| BNB | WBNB on BSC via GMGN/DexScreener |

---

## 12. Health · Validation · Errors

### 12.1 Health endpoints (public — no API key)

| Endpoint | Response |
|----------|----------|
| `GET /api/v1/health` | App liveness + `checkedAt` |
| `GET /api/v1/integrations/health` | 13 providers snapshot |
| `GET /api/v1/integrations/rpc/health` | Solana + BSC + Ethereum RPC |

**Aggregate status:** all down → `down` · any down → `degraded` · else `ok`

**Placeholder behavior:** demo API keys / placeholder RPC → **`degraded` in 0ms** (no external hang)

### 12.2 Config validation

```bash
npm run validate:integrations
# → validateMergedIntegrations(docs/settings.defaults.json)
# → rejects invalid ethereumRpcUrl
```

**PATCH /settings:** invalid integrations → **HTTP 400** (`IntegrationsConfigValidationError`)

**Masked PATCH:** `stripMaskedIntegrationPatch` — values `***` or masked RPC do not overwrite live secrets.

### 12.3 Typed error map

| Integration | Error classes | Retry? |
|-------------|---------------|--------|
| GMGN | `GmgnRateLimitError` · `GmgnApiError` · `GmgnConfigurationError` | 429: 1× wait retry |
| ChangeNOW | `ChangeNowTimeoutError` · `ChangeNowValidationError` | funding service retry |
| OpenAI | `OpenAiConfigurationError` · `OpenAiResponseError` | trend-finder backoff |
| RPC | `SolanaRpcError` · `RpcConfigurationError` | client maxRetries |
| Etherscan | `EtherscanRateLimitError` | caller backoff |
| Pump/FourMeme/LetsBonk | `*.errors.ts` per module | trade engine retry |

### 12.4 On-chain verification (cross-integration contract)

**هر persist trade/launch/sell/funding leg:**

| Network | Verify method | Client |
|---------|---------------|--------|
| Solana | Transaction confirmed | `SolanaRpcClient.hasConfirmedTransaction(txHash)` |
| BSC | Receipt status=1 | `BscRpcClient.hasSuccessfulTransaction(txHash)` |

Used by: `token-factory` · `trade-engine` · `profit-sell-executor` · `emergency-sell` · `consolidate-executor`

### 12.5 Proxy layer

All HTTP integrations use `HttpClientService` with optional proxy from `settings.proxy`:

```json
{
  "proxy": {
    "enabled": true,
    "url": "socks5://user:pass@host:port"
  }
}
```

Supported schemes: `http` · `https` · `socks5` · `socks4` · `ssh` (see `main-info.md` §3.7.4)

---

## 13. Performance Matrix + Runbook

### 13.1 Latency & throughput targets

| Integration | p95 target | Bottleneck knob |
|-------------|------------|-----------------|
| GMGN read | < 2s | `defaultTimeoutMs` · premium API tier |
| GMGN swap (critical) | < 30s | `criticalTimeoutMs` · `gmgnPrivateKey` |
| ChangeNOW poll | < 15 min | `pollTimeoutMs` · parallel concurrency 20 |
| Solana RPC send | < 500ms | QuickNode dedicated · priority fee |
| BSC RPC send | < 1s | QuickNode BSC |
| OpenAI chat | < 60s | `chatTimeoutMs` · gpt-4o |
| DexScreener | < 1s | public — rate limit rare |
| Native prices cache | < 50ms | Redis TTL `priceCacheSeconds` |

### 13.2 Provider priority (trade / price)

From `runtime.trade.providerPriority` (default):

```
gmgn → dexscreener → changenow
```

### 13.3 Pre-live integration checklist

> **جدول کامل credentials:** §0 — هر ردیف را تیک بزن قبل از live.

- [ ] §0.2 — همه ردیف‌های 🔴 BLOCK تیک خورده
- [ ] §0.2 — ردیف‌های 🟡 RECOMMENDED (Telegram · Etherscan · Solscan)
- [ ] `npm run validate:integrations` exit 0
- [ ] All QuickNode URLs set (no `YOUR_ENDPOINT` placeholder)
- [ ] `GET /integrations/health` — `gmgn` · `changenow` · `openai` = `up`
- [ ] `GET /integrations/rpc/health` — solana + bsc + ethereum `up`
- [ ] `mainFeeWalletEvmPrivateKey` matches `GET /main-fee-wallet` `bscAddress`
- [ ] Main Fee: **USDC@ETH + ETH@ETH** — نسبت [`cost-model.md`](./cost-model.md) (ETH ≥ **$150** @ $5K tier)
- [ ] `npm run start:worker` در حال اجرا (ردیف #27)
- [ ] Settings PATCH: `marketWalletCount: 200` · `maxInvestmentUsd: 5000` · `sellInRed: false`
- [ ] Smoke: `POST /core-trigger/cycles` با **۵ wallet** → `COMPLETED` · سپس scale

### 13.4 Recovery playbooks

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| All integrations `degraded` | Demo keys still in settings | PATCH live keys |
| `solana-rpc down` | Bad QuickNode URL / quota | Fix URL · check QuickNode dashboard |
| GMGN 429 storm | Rate limit | Reduce poll frequency · wait reset · upgrade tier |
| ChangeNOW stuck `waiting` | Deposit not sent / **ETH gas insufficient** | Check ETH@Ethereum · `FundingTransaction.depositTxHash` |
| ChangeNOW `expired` | Slow deposit · gas too low | شارژ ETH · new exchange · `pollTimeoutMs` |
| `below ChangeNOW minimum` | min لحظه‌ای > `amountPerWalletUsd` | صبر · یا بالا بردن `minTradeAmountUsd` · retry |
| Native price error | All 3 providers failed | `POST /native-prices/refresh` · check GMGN/DexScreener |
| FourMeme auth fail | Expired access token | Redis cache TTL 23h — auto re-auth on next create |
| Trade verify fail | RPC lag | Retry · increase `confirmTimeoutMs` |
| PATCH settings no effect | Cache | Auto invalidator runs — restart worker if stale |

### 13.5 Automation guarantee

  ```
  Settings (DB) ──► IntegrationsConfigService.getFull()
                        │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
      GmgnClient   ChangeNow    SolanaRpc
          │            │            │
          └────────────┴────────────┘
                        │
                BullMQ Workers (REQUIRED)
                        │
                On-chain verify ──► DB persist
  ```

**Zero-gap rules:**

1. **No hardcoded secrets** — همه keys از Settings
2. **No simulate-money** — funding/trade/sell همه on-chain + verify
3. **No silent fail** — typed errors · CycleLog · Telegram
4. **Worker required** — API alone cannot complete funding or market making
5. **Validate before live** — `validate:integrations` + health probes
6. **Main Fee composition** — USDC + **ETH buffer** برای ChangeNOW deposits (نه فقط USDC)
7. **Budget guard** — `maxInvestmentUsd` enforced در `core-trigger` + `market-generator`

---

*v3.0 — aligned with cost-model · implementation-roadmap · 119 tests*

*پایان سند — v2.0 Production Hardened*