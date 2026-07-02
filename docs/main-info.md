# سند فنی — سیستم خودکار توکن و مارکت‌میکینگ (Solana + BSC)

> **نسخه: 3.0 — Production Hardened** (۲۰۲۶-۰۶-۲۲)  
> **وضعیت:** ✅ ۱۲/۱۲ ماژول operational · `npm run build` سبز · **119** unit test · worker + API جدا  
> مخاطب: تیم فنی · اپراتور · سرمایه‌گذار  
> Stack: **NestJS + PostgreSQL + Redis + BullMQ + Prisma**  
> OpenAPI: `GET http://localhost:5420/docs-json` (تولید زنده از کد)  
> Integrations: `docs/external-integrations.md`  
> Economics: §19 Blitz + §20 Bot Magnet  
> Operational flow: §23 · Runbook: §25 · Hardening: §24  
> Cost model: `docs/cost-model.md`  
> Stage prompts (Agent): `docs/cursor-stage-prompts.md`  
> منبع: کد production + مشاهده مستقیم + مستندات رسمی APIها

---

### وضعیت production — خلاصه اجرایی

| لایه | تضمین عملیاتی |
|------|----------------|
| **پول واقعی** | ChangeNOW poll تا `COMPLETED` · ledger debit · balance از chain |
| **لانچ امن** | Security gate GMGN **قبل از** funding · benchmark از trending · `FAILED` خودکار |
| **Trade واقعی** | buy/sell on-chain + RPC verify · idempotent DB · Redis crash recovery |
| **Blitz + Bot Magnet** | StrategyOptimizer + VisibilityOrchestrator wired به tick |
| **قفل سود** | Profit Extractor · **creator ≤10%** (`capAppliesTo: TOKEN_OWNER`) · **market TWAP** · floor 20% · tx verify |
| **ایمنی** | Emergency brake: halt 4 queue · Redis `system:operational:halt` · sell + sweep · `GET /halt` · `POST /resume` |
| **خزانه** | Consolidate + Lifecycle drain→rearm on-chain · Redis lock |
| **اتوماسیون** | Cron از settings · Telegram retry · typed errors در همه ماژول‌ها |

> **قانون طلایی:** API بدون worker = queue پر ولی job اجرا نمی‌شود. همیشه **هر دو** process بالا باشند (§14 · §25).

--- 

## 1. نمای کلی

سیستم یک پلتفرم خودکار چندسرویسه برای **ساخت توکن، بازارگردانی (Market Making)، و افزایش متریک‌های بازار** روی دو شبکه **Solana** و **BSC** است.

### 1.1 شبکه‌های پشتیبانی‌شده
| شبکه | کاربرد |
|------|--------|
| Solana (SOL) | ساخت توکن، معامله، مدیریت ولت |
| BSC (BNB Chain) | ساخت توکن، معامله، مدیریت ولت |

### 1.2 لانچ‌پدها و APIهای خارجی
سیستم از API لانچ‌پدهای زیر استفاده می‌کند:

| لانچ‌پد | شبکه | نقش |
|---------|------|-----|
| Pump.fun | Solana | ساخت و لانچ توکن (بانکینگ کرو، auto-selection) |
| FourMeme | BSC | ساخت و لانچ توکن |
| letsbonk | Solana | ساخت و لانچ توکن (auto-selection) |
| **Custom Raydium (منوال لانچ‌پد)** | Solana | لانچ‌پد اختصاصی خودمان — SPL mint + Raydium CPMM pool + custodial LP lock؛ **پیش‌فرض سیستم** (`strategy.defaultLaunchpad = "CUSTOM_RAYDIUM"`)، قابل override با `forceLaunchpad` یا با تغییر تنظیم به `"AUTO"`/لانچ‌پد دیگر. جزئیات: بخش ۲۶ |
| GMGN | Solana / BSC | داده بازار، تحلیل، و API مارکت |

---

## 2. معماری سرویس‌ها

```
┌─────────────────────────────────────────────────────────────────┐
│                     CORE TRIGGER (هسته ارکستراسیون)              │
│  زمان‌بندی Cron │ استراتژی │ هماهنگی همه سرویس‌ها │ گزارش TG   │
└────────────┬────────────────────────────────────────────────────┘
             │
    ┌────────┼────────┬──────────┬──────────┬──────────┐
    ▼        ▼        ▼          ▼          ▼          ▼
 Trend    Wallet   Token      Market    Security   Liquidity
 Finder   Generator Factory   Generator  Check     Analyzer
    │        │        │          │          │          │
    └────────┴────────┴──────────┴──────────┴──────────┘
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
         Main Fee Wallet      Token Info Service
              │                     │
              ▼                     ▼
         Settings Service    (مارکت‌کپ، ولوم، LP، ...)
```

---

## 3. سرویس‌ها — جزئیات فنی

### 3.1 Main Fee Wallet (ولت funding) و ولت برداشت سود

**دو نقش جدا:**

| نقش | Settings | API |
|-----|----------|-----|
| **Funding** | `mainFeeWalletEvmPrivateKey` | `GET /main-fee-wallet` → `fundingAddress`, `fundingTotalUsd`, `balanceUsdc`, `balanceEth` |
| **Withdrawal (سود)** | `nativeWithdrawalSolanaAddress`, `nativeWithdrawalBscAddress` | `balanceSol`, `balanceBnb`, `withdrawalTotalUsd` |

Emergency / drain / profit-extract همه native را به **withdrawal addresses** sweep می‌کنند — نه به funding wallet.

راهنمای فرانت: [`docs/frontend-emergency-treasury.md`](frontend-emergency-treasury.md).

| مشخصه | مقدار / رفتار production |
|-------|--------------------------|
| موجودی production | **$5K–$10K** توصیه (§23.11) |
| EVM address | ثابت از `integrations.mainFeeWalletEvmPrivateKey` — **نه generate تصادفی** |
| Balance refresh | Funding: USDC+ETH (Ethereum) · Withdrawal: SOL+BNB روی آدرس‌های جدا |
| Funding flow | `POST /fund` → BullMQ → ChangeNOW → poll تا `COMPLETED` |
| Convert سود | `convertTo: USDC` → Jupiter (SOL) / ChangeNOW (BNB) روی ولت withdrawal |
| HTTP | `POST /fund` → **202 Accepted** (async worker) |

---

### 3.2 Trend Finder (یافتن ترند)

**نقش:** تولید خودکار هویت توکن بر اساس موضوعات ترند لحظه‌ای.

| ورودی | خروجی |
|-------|-------|
| داده ترند (از AI) | نام توکن (Name) |
| — | نماد توکن (Symbol/Ticker) |
| — | لوگو ۱:۱ (تصویر) |
| — | توضیحات (Description) — جنجالی و ترندمحور |

**رفتار:**
- به‌صورت تصادفی یک موضوع «ترند و همه‌پسند» را از طریق **AI** انتخاب می‌کند.
- نام، نماد و لوگوی تولید‌شده دقیقاً مطابق چیزی است که در آن لحظه در فضای عمومی ترند است و مخاطب آن را می‌شناسد/دوست دارد.
- خروجی مستقیماً به **Token Factory** و **Core Trigger** تزریق می‌شود.

> **مستند فنی کامل:** §16 — Pipeline ۴ مرحله‌ای، System/User Prompts، Validation، NestJS Service

---

### 3.3 Wallet Generator (تولیدکننده ولت)

**نقش:** ساخت و مدیریت کامل ولت‌های Solana و BSC.

#### 3.3.1 دو مدل ولت

| مدل | نام | کاربرد | مصرف |
|-----|-----|--------|------|
| A | **Token Owner Wallet** | مالکیت توکن (Token Owner) | یک‌بارمصرف — هر توکن = یک ولت اختصاصی |
| B | **Token Market Wallet** | مارکت‌میکینگ و معاملات | یک‌بارمصرف یا چندبارمصرف (قابل تنظیم در Settings) |

#### 3.3.2 قابلیت‌های مدیریتی
- کنترل **۱۰۰٪** روی تمام ولت‌های تولید‌شده (کلید خصوصی، موجودی، تراکنش)
- واریز (Deposit) و برداشت (Withdraw)
- ردیابی موجودی (Balance Tracking)
- مدیریت کارمزد (Fee Management)
- یکپارچگی کامل با **Main Fee Wallet** برای تأمین وجه اولیه

#### 3.3.3 حالت‌های مصرف
| حالت | توضیح | تنظیم |
|------|-------|-------|
| Single-use (یک‌بارمصرف) | ولت پس از یک چرخه عملیاتی کنار گذاشته می‌شود | Settings |
| Multi-use (چندبارمصرف) | ولت در چند چرخه قابل استفاده مجدد است | Settings |

> **استثنا:** ولت Token Owner همیشه یک‌بارمصرف است — هر توکن دقیقاً یک ولت Owner اختصاصی دارد.

---

### 3.4 Liquidity Analyzer (تحلیل‌گر نقدینگی)

**نقش:** اندازه‌گیری دقیق نقدینگی (Liquidity) توکن روی مارکت‌های مختلف.

| منبع داده | لانچ‌پد / مارکت |
|-----------|-----------------|
| داخلی | Pump.fun, FourMeme, letsbonk |
| وابسته | مارکت‌هایی که این لانچ‌پدها به آن‌ها متصل هستند |

**خروجی:** میزان LP فعلی توکن روی هر مارکت — برای تصمیم‌گیری Core Trigger و Market Generator.

---

### 3.5 Token Info Service (اطلاعات توکن)

**نقش:** جمع‌آوری و ارائه متریک‌های بازار توکن.

| متریک | توضیح |
|-------|-------|
| Market Cap | ارزش بازار |
| Volume | حجم معاملات |
| Liquidity | نقدینگی |
| Buy/Sell Count | تعداد خرید و فروش |
| Market Sentiment | میل بازار (Bullish/Bearish) |

**مصرف‌کننده:** Core Trigger، Market Generator، گزارش Telegram.

---

### 3.6 Security Check Service (بررسی امنیت توکن)

**نقش:** Gate امنیتی **قبل از funding و لانچ** — توکن risky هرگز on-chain نمی‌شود.

| ورودی | خروجی |
|-------|-------|
| Benchmark address (از GMGN trending) | امتیاز: **۰–۱۰۰** |
| GMGN security + token info | `isSafe` · لیست risks |
| — | `SecurityReport` persist در DB |

**Provider:** GMGN — `GET /v1/token/security` + `GET /v1/token/info` (§11 · `docs/external-integrations.md` §2)

#### 3.6.1 فلو production (`runCycleSecurityGate`)

```
WALLET_GENERATION done
        │
        ▼
  cached SecurityReport fresh? (< 1h)
        │ YES → assertPassesGate → continue
        │ NO  → refresh
        ▼
  resolveGateCheckAddress(network, launchpad)
    └── GMGN trending swaps → pickBenchmarkAddress (§security-gate.util)
        ▼
  checkToken(benchmark) — retry 3× backoff (security-retry.util)
        ▼
  ensurePlannedToken (pending:cycleId if not exists)
        ▼
  score ≥ securityMinScore AND isSafe ?
        │ NO  → persistReport (audit) → SecurityCheckGateError → cycle FAILED
        │ YES → persistReport → continue to FUNDING
```

| جزئیات hardened | پیاده‌سازی |
|-----------------|------------|
| Benchmark ≠ توکن ما | آدرس نمونه از trending همان launchpad/network |
| Stale cache | `isSecurityReportStale(checkedAt, 3600s)` → refresh |
| Audit trail | gate fail هم `SecurityReport` persist می‌شود |
| `check_address` | ستون DB — آدرس benchmark استفاده‌شده (migration `20250622150000`) |
| Retry GMGN | exponential backoff · non-retryable config errors |
| Redis cache | `gmgn:security:{chain}:{address}` TTL 300s |
| Core Trigger | `SecurityCheckProcessor` → `CoreTriggerStepError('SECURITY_CHECK')` |

**API:** `GET/POST /api/v1/security/check` · `securityMinScore` از Settings (پیش‌فرض 70)

---

### 3.7 Settings Service (سرویس تنظیمات)

**نقش:** مرکز پیکربندی کل سیستم.

#### 3.7.1 تنظیمات عملیاتی
| پارامتر | توضیح |
|---------|-------|
| Cron Job | زمان‌بندی فعالیت خودکار (هر چند ساعت یک چرخه) |
| Network Priority | اولویت فعالیت بین Solana و BSC |
| AI Settings | پارامترهای Trend Finder (مدل، prompt، ...) |
| Max Investment | حداکثر سرمایه‌گذاری در هر چرخه |
| Min Trade Amount | حداقل مبلغ هر معامله |
| Min Market Cap | حداقل مارکت‌کپ هدف |
| Min Liquidity | حداقل نقدینگی هدف |
| Wallet Mode | یک‌بارمصرف / چندبارمصرف (به‌جز Token Owner) |
| Wallet Count | تعداد ولت Market (۱۰۰ تا ۲۰۰ — قابل تنظیم) |

#### 3.7.2 Integrations — فقط از Settings (نه hardcode / نه .env)

> **اصل:** تمام API Key، RPC، Telegram، و Proxy از **PostgreSQL Settings** خوانده می‌شوند.  
> `.env` فقط برای زیرساخت (DB، Redis، KMS، Admin API Key) است.  
> Seed اولیه: `docs/settings.defaults.json` — مقادیر **دمو** که کاربر از `PATCH /settings` عوض می‌کند.

| فیلد Settings | کاربرد | مقدار دمو (seed) |
|---------------|--------|------------------|
| `integrations.openaiApiKey` | Trend Finder | `sk-demo-openai-replace-via-settings` |
| `integrations.gmgnApiKey` | TokenInfo + Security + Trade | `gmgn_demo_key_replace_via_settings` |
| `integrations.gmgnPrivateKey` | GMGN swap (unused — platform signs its own wallets) | `""` |
| `integrations.changeNowApiKey` | Funding cross-chain | `changenow_demo_key_replace_via_settings` |
| `integrations.pumpPortalApiKey` | Pump.fun trade-local (optional) | `""` |
| `integrations.solanaRpcUrl` | RPC Solana | `https://api.mainnet-beta.solana.com` |
| `integrations.evmRpcUrl` | RPC EVM (BSC و سایر EVM) | `https://bsc-dataseed.binance.org` |
| `integrations.etherscanApiKey` | Explorer **همه EVM** (v2 + chainid) | `etherscan_demo_key_replace_via_settings` |
| `integrations.solanaScanApiKey` | Explorer Solana فقط | `solscan_demo_key_replace_via_settings` |
| `telegram.botToken` | Telegram Bot | `""` |
| `telegram.chatIds` | مقصد گزارش‌ها | `[]` |
| `proxy.enabled` | فعال/غیرفعال | `false` |
| `proxy.url` | URL کامل پروکسی | `""` |


#### 3.7.3 Etherscan API v2 — یک Key برای همه EVM

```
Base: https://api.etherscan.io/v2/api
Auth: apikey={integrations.etherscanApiKey}
Param: chainid=56  (BSC) | 1 (ETH) | 8453 (Base) | ...

مثال BSC tx list:
GET ...?chainid=56&module=account&action=txlist&address=0x...&apikey=...
```

> دیگر API جداگانه BscScan لازم نیست — همان کلید Etherscan برای BSC و سایر EVMها.

#### 3.7.4 Proxy — فرمت URL واحد

کاربر **یک رشته URL** می‌دهد (در Settings یا Admin UI):

```
socks5://username:password@host:port
http://username:password@host:port
```

**مثال فرمت (مقدار واقعی را کاربر در Settings ست می‌کند):**
```
socks5://USER:PASS@82.29.117.229:45271
```

**NestJS — parse در `ProxyService`:**
```typescript
parseProxyUrl(url: string): ProxyConfig {
  if (!url) return { enabled: false };
  const u = new URL(url);
  return {
    enabled: true,
    type: u.protocol.replace(':', '').toUpperCase(), // SOCKS5 | HTTP
    host: u.hostname,
    port: Number(u.port),
    username: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
  };
}
```

| `proxy.enabled` | `proxy.url` | رفتار |
|-----------------|-------------|-------|
| `false` | `""` | اتصال مستقیم |
| `true` | `socks5://...` | همه HTTP/RPC از SOCKS5 |
| `true` | `http://...` | همه HTTP/RPC از HTTP proxy |

> SSH tunnel: اگر لازم شد — فیلد جدا `proxy.sshUrl` (optional)؛ پیش‌فرض SOCKS5/HTTP URL کافی است.

#### 3.7.5 Telegram
| پارامتر | Settings path |
|---------|---------------|
| Bot Token | `telegram.botToken` |
| Chat IDs | `telegram.chatIds[]` |

#### 3.7.6 Settings API — مثال PATCH

```json
PATCH /api/v1/settings
{
  "integrations": {
    "openaiApiKey": "sk-prod-...",
    "gmgnApiKey": "real-gmgn-key",
    "gmgnPrivateKey": "-----BEGIN PRIVATE KEY-----...",
    "changeNowApiKey": "real-changenow-key",
    "solanaRpcUrl": "https://mainnet.helius-rpc.com/?api-key=...",
    "evmRpcUrl": "https://bsc-mainnet.quiknode.pro/...",
    "etherscanApiKey": "single-etherscan-v2-key"
  },
  "telegram": {
    "botToken": "123456:ABC...",
    "chatIds": ["-1001234567890"]
  },
  "proxy": {
    "enabled": true,
    "url": "socks5://USER:PASS@82.29.117.229:45271"
  }
}
```

**Reload:** `SettingsService` بعد از PATCH → Redis `settings:current` invalidate → همه ماژول‌ها config جدید می‌گیرند (بدون restart).

---

### 3.8 Token Factory (کارخانه توکن)

**نقش:** ساخت توکن روی لانچ‌پدها با کنترل کامل.

| ورودی | خروجی |
|-------|-------|
| Trend Finder (name, symbol, logo, description) | توکن لانچ‌شده روی لانچ‌پد انتخابی |
| Settings (network, launchpad config) | آدرس قرارداد / Mint Address |
| Wallet Generator (Token Owner Wallet) | مالکیت توکن |

**وابستگی‌ها:**
- Wallet Generator
- Security Check
- Trend Finder
- Main Fee Wallet
- Settings

**شبکه‌ها و لانچ‌پدها:** Solana (Pump.fun, letsbonk) | BSC (FourMeme)

---

### 3.9 Market Generator (تولیدکننده بازار)

**نقش:** ساخت ولت‌ها، اجرای معاملات، و افزایش متریک‌های بازار.

| قابلیت | جزئیات |
|--------|--------|
| ساخت ولت | سریع و امن — از Wallet Generator |
| معامله | خرید/فروش توکن بین ولت‌ها روی شبکه و مارکت هدف |
| افزایش متریک | قیمت، مارکت‌کپ، ولوم، تعداد Buy/Sell |
| بهینه‌سازی هزینه | کمترین Gas/Fee ممکن |
| سرعت | معاملات با فرکانس بسیار بالا |

**وابستگی‌ها:**
- Main Fee Wallet
- Wallet Generator
- Liquidity Analyzer
- Security Check
- Token Info Service

---

## 4. Core Trigger — هسته ارکستراسیون

**نقش:** اتصال تمام سرویس‌ها، اجرای استراتژی خودکار، و تولید سود.

> جزئیات کامل استراتژی سودآوری مشخص نیست؛ جریان زیر از مشاهده مستقیم استخراج شده است.

### 4.1 فلوچارت عملیاتی (یک چرخه کامل)

```
[START — Cron Trigger]
        │
        ▼
┌───────────────────┐
│  1. Trend Finder  │ → نام + نماد + لوگو 1:1 + description ترند
└─────────┬─────────┘
          ▼
┌───────────────────┐
│  2. Launchpad     │ → بررسی Sol vs BSC: کدام لانچ‌پد الان بهتر است؟
│     Selection     │ → انتخاب بهترین لانچ‌پد لحظه‌ای
└─────────┬─────────┘
          ▼
┌───────────────────┐
│  3. Wallet Gen    │ → 1× Token Owner Wallet
│                   │ → 100–200× Market Wallets (طبق Settings)
└─────────┬─────────┘
          ▼
┌───────────────────┐
│  4. Security Check│ → امتیاز 0–100؛ رد شدن اگر Risky
└─────────┬─────────┘
          ▼
┌───────────────────┐
│  5. Fund Wallets  │ → ChangeNOW: USDC/ETH از Main Fee Wallet
│     (ChangeNOW)   │ → تبدیل به SOL یا BNB
│                   │ → توزیع به تک‌تک Market Wallets
└─────────┬─────────┘
          ▼
┌───────────────────┐
│  6. Token Factory │ → ساخت توکن روی لانچ‌پد + Token Owner Wallet
└─────────┬─────────┘
          ▼
┌───────────────────┐
│  7. Market Gen    │ → شروع خرید/فروش سریع بین ولت‌ها
│     (Market Make) │
└─────────┬─────────┘
          ▼
┌───────────────────┐
│  8. Monitor + TG  │ → گزارش وضعیت / موجودی / بازار
└───────────────────┘
```

### 4.2 پارامترهای عملکرد Market Generator (مشاهده‌شده)

| متریک | مقدار |
|-------|-------|
| فرکانس معامله | ~**120** خرید/فروش در **۱ دقیقه** |
| مجموع Blitz | ~**540** در **۴.۵ دقیقه** (deadline T+5) |
| رشد قیمت | **≥ +500%** تا T+4:59 |
| LP | **≥ 95% LP_max** همزمان با رشد |
| Vol 5m | **≥ $100,000** |
| مارکت‌کپ هدف | **≥ $50,000** |

### 4.3 نتیجه چرخه
- توکن شروع به **جذب مشتریان خارجی و ربات‌ها** می‌کند.
- **افزایش سرمایه** (Capital Inflow) از بازار واقعی.
- نقدینگی (Liquidity) به **بالاترین حجم ممکن** می‌رسد.
- عملیات با **حداقل هزینه** و **حداکثر سرعت** انجام می‌شود — بدون ضرر مشاهده‌شده در چرخه‌های موفق.

### 4.4 زمان‌بندی
- اجرا به‌صورت **Cron Job** — فاصله قابل تنظیم در Settings (هر چند ساعت یک بار).
- در پایان/حین هر چرخه: **گزارش کامل Telegram**.

> **خلاصه یک‌صفحه‌ای کل flow:** §23 Operational Summary

### 4.5 گزارش Telegram

| رویداد | محتوای گزارش |
|--------|-------------|
| موجودی Main Fee Wallet تمام شد | هشدار + وضعیت فعلی |
| وضعیت بازار | مارکت‌کپ، ولوم، LP، Buy/Sell |
| پایان چرخه | خلاصه عملکرد |
| خطا / توقف | جزئیات قابل تحلیل |

> گزارش‌ها **کامل، خوانا، و قابل تحلیل** هستند.

---

## 5. قابلیت‌های اضطراری و مدیریت سود

### 5.1 Manual Brake (ترمز دستی — تخلیه اضطراری)

| مشخصه | مقدار production |
|-------|------------------|
| عملکرد | فروش **۱۰۰٪** توکن + sweep native → Main Fee · pause market queue |
| On-chain | هر sell/sweep **RPC verify** قبل از log |
| Concurrency | BullMQ `emergency-sell` + `emergency-sweep` · Redis global lock |
| Retry | `withEmergencySellRetries` · typed `EmergencyBrakeError` |
| فعال‌سازی | `POST /emergency/brake` · scope: `CYCLE` یا `GLOBAL` · `convertTo: NATIVE` (پیش‌فرض) |
| System halt | Redis `system:operational:halt` — block `startCycle` تا resume |
| وضعیت halt | `GET /emergency/halt` |
| Resume | `POST /emergency/resume` — فقط بعد از بررسی دستی |
| GLOBAL | pause 4 queue · cancel pending jobs · optional full treasury drain |

> **مستند فنی کامل:** §17 · **Recovery:** §25.6

### 5.2 Profit Extractor (استخراج سود — creator cap + market TWAP)

| مشخصه | مقدار production |
|-------|------------------|
| **Creator cap** | `maxTokenHoldPercent` (10%) فقط **TOKEN_OWNER** — `capAppliesTo: TOKEN_OWNER` |
| **Market position** | ~۲۰۰ MARKET wallet — اکثر supply · هر wallet % کوچک (organic) |
| **Market TWAP** | `MARKET_TWAP` — batch از market wallets · فقط در سبز (`sellInRed: false`) |
| **Market floor** | `minMarketHoldPercent: 20` — TWAP زیر 20% supply متوقف |
| **Owner trim** | `OWNER_TRIM` — فقط اگر creator > 10% |
| Verify | tx confirmed قبل از ledger · `tx_hash` در DB |
| Lock | Redis `profit:extract:lock:{cycleId}` |
| مقصد | Main Fee Wallet ledger IN |

> **مستند فنی کامل:** §18 · §18.14 Hardening

### 5.3 Treasury Consolidator (تجمیع SOL + BSC — آدرس مقصد متغیر)

| مشخصه | مقدار |
|-------|-------|
| عملکرد | فروش **۱۰۰٪** توکن قابل‌فروش + sweep **SOL/BNB/USDC** از **همه ولت‌ها** → **آدرس مقصد** (هر بار متفاوت) |
| شبکه | Solana و BSC — جدا یا **هر دو در یک job** |
| مقصد | `destinationAddress` — **هر بار از Settings/API** (نه ثابت Main Fee Wallet) |
| فعال‌سازی | `POST /treasury/consolidate` |
| SLA | 200 wallet → sell + sweep + transfer **< 120s** |

> **مستند فنی کامل:** §21 — فلو ۱۱ مرحله‌ای، multi-network، destination per-run

**تفاوت با §17 Manual Brake:**

| | Manual Brake §17 | Treasury Consolidator §21 |
|--|------------------|---------------------------|
| مقصد | همیشه Main Fee Wallet | **آدرس دلخواه هر بار** |
| هدف | توقف اضطراری | **تجمیع سود / خالی کردن سیستم** |
| شبکه | cycle scope | SOL + BSC + GLOBAL |

### 5.4 Treasury Lifecycle (چرخه خالی → شارژ → آماده‌سازی مجدد)

| فاز | عمل | API |
|-----|-----|-----|
| **A — Drain** | خالی کردن **کامل** همه ولت‌ها → Main Fee Wallet | `POST /treasury/drain` |
| **B — Top-up** | واریز خارجی USDC/ETH به Main Fee (در صورت نیاز) | واریز on-chain + `GET /main-fee-wallet` |
| **C — Rearm** | ولت **جدید** یا **بازاستفاده** + Funding از Main Fee | `POST /treasury/rearm` |
| **D — Run** | شروع چرخه بعدی (Cron یا دستی) | Core Trigger |

> **مستند فنی کامل:** §22 — state machine ولت، FRESH vs REUSE، فلو یک‌کلیکی

**هر وقت بخواهید:** فقط فاز A را دوباره بزنید — سیستم دوباره خالی می‌شود.

---

## 6. خلاصه وابستگی‌های بین سرویس‌ها

```
Settings ──────────────────────────────────────────► همه سرویس‌ها
Main Fee Wallet ◄──► Wallet Generator ◄──► Market Generator
Trend Finder ──► Token Factory ◄── Wallet Generator (Owner)
Token Factory ──► Market Generator
Security Check ──► Core Trigger (Gate) ──► Market Generator
Liquidity Analyzer ──► Market Generator / Core Trigger
Token Info ──► Core Trigger / Telegram Reports
ChangeNOW ──► Core Trigger (Fund Distribution)
GMGN / OpenAI / RPC / Explorer / ChangeNOW ──► سرویس‌های مربوطه
Proxy ──► تمام HTTP/RPC Requestها
Telegram ──► Core Trigger (Notifications)
```

---

## 7. نکات معماری

| نکته | توضیح |
|------|-------|
| ماژولار بودن | هر سرویس مستقل و قابل توسعه |
| سادگی ساختار | افزودن لانچ‌پد/شبکه/API جدید بدون تغییر هسته |
| کنترل مالی کامل | Main Fee Wallet + Wallet Generator = مدیریت ۱۰۰٪ وجوه |
| امنیت پیش از اجرا | Security Check به‌عنوان Gate قبل از مارکت‌میکینگ |
| شفافیت عملیاتی | گزارش Telegram در تمام مراحل |

---

## 8. چک‌لیست پیاده‌سازی (برای تیم فنی)

> **آخرین audit:** ۲۰۲۶-۰۶-۲۲ — همه موارد زیر در کد hardened و تست‌شده‌اند.

- [x] **Main Fee Wallet** — ChangeNOW poll · ledger · balance chain · EVM key از settings
- [x] **Core Trigger** — funding gate · cron از settings · FAILED + CycleLog + TG
- [x] **Security Check** — GMGN gate قبل از funding · SecurityReport · benchmark address
- [x] **Wallet Generator** — RPC balance · `assertWalletFunded` · cache 5s
- [x] **Token Factory** — on-chain verify · launch lock/pending · crash recovery
- [x] **Trend Finder** — 4-step pipeline · retry · Redis lock · symbol collision
- [x] **Market Generator** — trade on-chain · tx verify · tick lock · strategy از settings
- [x] **Strategy Optimizer** — Blitz §19 wired به `runTick`
- [x] **Visibility + TokenInfo + Liquidity** — Bot Magnet §20 · metric snapshots
- [x] **Profit Extractor** — creator cap · market TWAP · floor 20% · tx_hash · Redis lock (§18)
- [x] **Emergency + Telegram** — system halt · halt/resume API · sell/sweep verify · TG
- [x] **Treasury Consolidator + Lifecycle** — on-chain · locks · drain→wait→rearm (§21–§22)
- [x] **Settings** — PATCH validation · masked field protection · integrations cache invalidate
- [x] **Integrations health** — RPC/GMGN/ChangeNOW probes · `validate:integrations` script
- [x] **Proxy Layer** — HTTP/SOCKS5/SSH از settings
- [x] **Unit tests** — 25 suite / **119** test در `test/unit/`

**قبل از live:** §23.10 Operational Readiness · §25 Runbook

---

## 9. معماری NestJS — Production Architecture

### 9.1 Stack فنی

| لایه | تکنولوژی | نقش |
|------|----------|-----|
| Runtime | Node.js 20 LTS | اجرای async I/O برای HFT |
| Framework | NestJS 10 | ماژولار، DI، Guards، Cron |
| ORM | Prisma / TypeORM | PostgreSQL persistence |
| Cache | Redis 7 | RPC cache، rate-limit، session state |
| Queue | BullMQ | Market making jobs، funding، sell-all |
| Scheduler | `@nestjs/schedule` | Cron cycles |
| HTTP Client | `@nestjs/axios` + keep-alive | External API calls via Proxy |
| Blockchain Sol | `@solana/web3.js` + `@coral-xyz/anchor` | TX signing، token ops |
| Blockchain BSC | `ethers.js` v6 | EVM TX، FourMeme |
| Crypto Storage | AES-256-GCM + Vault/KMS | Private key encryption at rest |
| Docs | `@nestjs/swagger` | Auto-generate from OpenAPI |
| Monitoring | Prometheus + Grafana | Latency، PnL، trade throughput |

### 9.2 دیاگرام لایه‌ای (Layered Architecture)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PRESENTATION LAYER                                 │
│  REST API (Swagger)  │  Admin Panel → [`admin-panel-spec.md`](./admin-panel-spec.md)  │  Telegram        │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼─────────────────────────────────────────┐
│                           APPLICATION LAYER (NestJS Modules)                 │
│                                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ CoreTrigger │  │ MarketGen    │  │ TokenFactory │  │ WalletGenerator │ │
│  │ Module      │  │ Module       │  │ Module       │  │ Module          │ │
│  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘  └────────┬────────┘ │
│         │                │                 │                    │          │
│  ┌──────▼──────┐  ┌──────▼───────┐  ┌──────▼───────┐  ┌────────▼────────┐ │
│  │ TrendFinder │  │ Liquidity    │  │ SecurityCheck│  │ MainFeeWallet   │ │
│  │ Module      │  │ Analyzer     │  │ Module       │  │ Module          │ │
│  └─────────────┘  └──────────────┘  └──────────────┘  └─────────────────┘ │
│                                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ TokenInfo   │  │ Settings     │  │ Telegram     │  │ Emergency       │ │
│  │ Module      │  │ Module       │  │ Module       │  │ Module          │ │
│  └─────────────┘  └──────────────┘  └──────────────┘  └─────────────────┘ │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼─────────────────────────────────────────┐
│                           INTEGRATION LAYER                                  │
│  PumpFun │ FourMeme │ LetsBonk │ GMGN │ OpenAI │ ChangeNOW         │
│  SolanaRPC │ BSCRPC │ SolanaScan │ EtherscanV2 │ ProxyAgent                 │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼─────────────────────────────────────────┐
│                           INFRASTRUCTURE LAYER                               │
│  PostgreSQL  │  Redis  │  BullMQ Workers  │  S3/MinIO (logos)  │  KMS     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 9.3 ساختار پوشه‌های NestJS

```
token-platform/
├── src/
│   ├── main.ts                          # Bootstrap + Swagger + Global pipes
│   ├── app.module.ts                    # Root module
│   │
│   ├── common/
│   │   ├── config/                      # @nestjs/config — env validation (Joi/Zod)
│   │   ├── database/                    # PrismaService / TypeORM
│   │   ├── redis/                       # RedisModule — cache + pub/sub
│   │   ├── queue/                       # BullMQ registration
│   │   ├── proxy/                       # parse proxy.url → SOCKS5/HTTP agent
│   │   ├── crypto/                      # Key encryption/decryption
│   │   ├── guards/                      # ApiKeyGuard
│   │   ├── filters/                     # Global exception filter
│   │   ├── interceptors/                # Logging + latency tracking
│   │   └── dto/                         # Shared enums (Network, Launchpad, ...)
│   │
│   ├── modules/
│   │   ├── settings/
│   │   │   ├── settings.module.ts
│   │   │   ├── settings.controller.ts
│   │   │   ├── settings.service.ts
│   │   │   └── entities/settings.entity.ts
│   │   │
│   │   ├── core-trigger/
│   │   │   ├── core-trigger.module.ts
│   │   │   ├── core-trigger.controller.ts
│   │   │   ├── core-trigger.service.ts          # State machine orchestrator
│   │   │   ├── core-trigger.scheduler.ts        # @Cron from settings
│   │   │   ├── cycle-state.machine.ts           # PENDING → ... → COMPLETED
│   │   │   └── processors/                      # BullMQ step processors
│   │   │
│   │   ├── wallet-generator/
│   │   │   ├── wallet-generator.module.ts
│   │   │   ├── wallet-generator.controller.ts
│   │   │   ├── wallet-generator.service.ts
│   │   │   ├── solana-wallet.provider.ts
│   │   │   └── bsc-wallet.provider.ts
│   │   │
│   │   ├── main-fee-wallet/
│   │   │   ├── main-fee-wallet.module.ts
│   │   │   ├── main-fee-wallet.controller.ts
│   │   │   ├── main-fee-wallet.service.ts
│   │   │   └── funding.processor.ts             # BullMQ: ChangeNOW batch fund
│   │   │
│   │   ├── trend-finder/
│   │   │   ├── trend-finder.module.ts
│   │   │   ├── trend-finder.controller.ts
│   │   │   ├── trend-finder.service.ts
│   │   │   └── logo-generator.service.ts        # GPT Image / image gen
│   │   │
│   │   ├── token-factory/
│   │   │   ├── token-factory.module.ts
│   │   │   ├── token-factory.controller.ts
│   │   │   ├── token-factory.service.ts
│   │   │   └── launchpad-selector.service.ts    # Best launchpad scoring
│   │   │
│   │   ├── market-generator/
│   │   │   ├── market-generator.module.ts
│   │   │   ├── market-generator.controller.ts
│   │   │   ├── market-generator.service.ts
│   │   │   ├── trade-engine.service.ts          # ~100 trades/min engine
│   │   │   └── processors/
│   │   │       └── market-making.processor.ts     # BullMQ concurrent workers
│   │   │
│   │   ├── liquidity-analyzer/
│   │   │   ├── liquidity-analyzer.module.ts
│   │   │   └── liquidity-analyzer.service.ts
│   │   │
│   │   ├── token-info/
│   │   │   ├── token-info.module.ts
│   │   │   ├── token-info.controller.ts
│   │   │   └── token-info.service.ts            # GMGN + on-chain aggregation
│   │   │
│   │   ├── security-check/
│   │   │   ├── security-check.module.ts
│   │   │   ├── security-check.controller.ts
│   │   │   └── security-check.service.ts        # GMGN security gate (score ≥ threshold)
│   │   │
│   │   ├── telegram/
│   │   │   ├── telegram.module.ts
│   │   │   └── telegram.service.ts              # Multi-chat reporting
│   │   │
 │   │   ├── treasury-consolidator/
 │   │   │   ├── treasury-consolidator.module.ts
 │   │   │   ├── treasury-consolidator.controller.ts
 │   │   │   ├── treasury-consolidator.service.ts   # §21 aggregate to dynamic address
 │   │   │   └── processors/ ...
 │   │   │
 │   │   ├── treasury-lifecycle/
 │   │   │   ├── treasury-lifecycle.module.ts
 │   │   │   ├── treasury-lifecycle.controller.ts
 │   │   │   ├── treasury-lifecycle.service.ts      # §22 drain → rearm orchestration
 │   │   │   ├── wallet-pool.service.ts             # FRESH | REUSE | AUTO
 │   │   │   └── processors/
 │   │   │       ├── lifecycle-drain.processor.ts
 │   │   │       └── lifecycle-rearm.processor.ts
 │   │   │
 │   │   ├── emergency/
│   │   │   ├── emergency.module.ts
│   │   │   ├── emergency.controller.ts
│   │   │   ├── emergency.service.ts             # Manual brake sell-all (§17)
│   │   │   └── processors/
│   │   │       ├── emergency-sell.processor.ts
│   │   │       └── emergency-sweep.processor.ts
│   │   │
│   │   └── profit-extractor/
│   │       ├── profit-extractor.module.ts
│   │       ├── profit-extractor.controller.ts
│   │       ├── profit-extractor.service.ts      # creator cap + market TWAP (§18)
│   │       ├── profit-extractor.scheduler.ts
│   │       ├── holding-calculator.service.ts
│   │       └── processors/
│   │           └── profit-sell.processor.ts
│   │
│   └── integrations/
│       ├── integrations.module.ts               # Dynamic provider registration
│       ├── gmgn/
│       │   ├── gmgn.client.ts
│       │   ├── gmgn-auth.service.ts
│       │   └── gmgn-security.scorer.ts
│       ├── openai/
│       │   └── openai.client.ts
│       ├── changenow/
│       │   ├── changenow.client.ts
│       │   └── changenow-funding.service.ts
│       ├── pump-fun/
│       │   ├── pump-fun-api.client.ts
│       │   ├── pump-portal.client.ts
│       │   └── pump-fun-sdk.service.ts
│       ├── four-meme/
│       │   ├── four-meme-api.client.ts
│       │   └── four-meme-chain.service.ts
│       ├── letsbonk/
│       │   └── letsbonk-sdk.service.ts
│       ├── solana-rpc/
│       │   └── solana-rpc.client.ts             # Connection pool + fallback RPCs
│       ├── bsc-rpc/
│       │   └── bsc-rpc.client.ts
│       ├── solana-scan/
│       │   └── solana-scan.client.ts
│       └── etherscan/
│           └── etherscan.client.ts              # v2 — one API key, chainid for all EVM
│
├── prisma/
│   └── schema.prisma                            # ERD → Prisma models
├── docs/
│   └── (OpenAPI زنده: /docs-json — از @nestjs/swagger)
├── test/
│   ├── e2e/
│   └── unit/
├── docker-compose.yml                           # postgres + redis + app
├── nest-cli.json
├── package.json
└── .env.example
```

### 9.4 NestJS Module Dependency Graph

```
AppModule
 ├── ConfigModule (global)
 ├── DatabaseModule
 ├── RedisModule
 ├── QueueModule (BullMQ)
 ├── ProxyModule (global)
 ├── SettingsModule ─────────────────────────────► injected everywhere
 ├── IntegrationsModule
 │    ├── GmgnClient (+ GmgnAuthService, GmgnSecurityScorer)
 │    ├── OpenAiClient
 │    ├── ChangeNowClient
 │    ├── PumpFunClient
 │    ├── FourMemeClient
 │    ├── LetsBonkClient
 │    ├── SolanaRpcClient
 │    ├── BscRpcClient
 │    ├── SolanaScanClient
 │    └── EtherscanClient
 ├── WalletGeneratorModule
 ├── MainFeeWalletModule ──► WalletGeneratorModule, ChangeNowClient
 ├── TrendFinderModule ──► OpenAiClient
 ├── SecurityCheckModule ──► GmgnClient (GET /v1/token/security)
 ├── LiquidityAnalyzerModule ──► GmgnClient, PumpFun, FourMeme, LetsBonk
 ├── TokenInfoModule ──► GmgnClient, SolanaRpc, BscRpc
 ├── TokenFactoryModule ──► TrendFinder, WalletGenerator, SecurityCheck, Launchpads
 ├── MarketGeneratorModule ──► WalletGenerator, TokenInfo, LiquidityAnalyzer, RPCs
 ├── TelegramModule
 ├── EmergencyModule ──► MarketGenerator, WalletGenerator
 ├── TreasuryConsolidatorModule ──► WalletGenerator, MarketGenerator, TokenInfo, SecurityCheck, ChangeNow, MainFeeWallet
 ├── TreasuryLifecycleModule ──► TreasuryConsolidator, MainFeeWallet, WalletGenerator, CoreTrigger
 ├── ProfitExtractorModule ──► TokenInfo, MarketGenerator, MainFeeWallet, Launchpads
 └── CoreTriggerModule ──► ALL modules above (orchestrator)
      ├── CoreTriggerScheduler (@Cron)
      ├── CycleStateMachine
      └── BullMQ Processors (8 steps)
```

### 9.5 State Machine — Core Trigger Cycle

```
PENDING
  → TREND_GENERATION        (TrendFinderService.generate)
  → LAUNCHPAD_SELECTION     (LaunchpadSelectorService.score)
  → WALLET_GENERATION       (WalletGeneratorService.batchCreate)
  → SECURITY_CHECK          (SecurityCheckService.check — GATE: score ≥ min)
  → FUNDING                 (MainFeeWalletService.fundViaChangeNow — BullMQ)
  → TOKEN_LAUNCH            (TokenFactoryService.launch)
  → MARKET_MAKING           (MarketGeneratorService.start — BullMQ workers)
  → MONITORING              (TokenInfo + LiquidityAnalyzer polling)
  → COMPLETED               (Telegram report + PnL snapshot)

  Any step failure → FAILED (Telegram alert + rollback where possible)
  Manual abort     → ABORTED
```

### 9.6 BullMQ Queues (Performance Critical)

| Queue | Name constant | Concurrency | نقش | Hardening |
|-------|---------------|-------------|-----|-----------|
| `cycle-orchestrator` | `QUEUE_CYCLE_ORCHESTRATOR` | 1 | State machine steps | Sequential · step errors → FAILED |
| `wallet-funding` | `QUEUE_WALLET_FUNDING` | 20 | ChangeNOW + native transfer | Poll COMPLETED · idempotent ledger |
| `market-making` | `QUEUE_MARKET_MAKING` | 50 | Buy/sell TX HFT | tick lock · trade pending · backoff |
| `profit-extract` | `QUEUE_PROFIT_SELL` | 1/cycle | TWAP profit sell | Redis lock · on-chain verify |
| `rpc-submit` | `QUEUE_RPC_SUBMIT` | 10 | TX broadcast retry | < 500ms p95 target |
| `telegram-notify` | `QUEUE_TELEGRAM_NOTIFY` | 5 | Async TG | stable jobId · 3 retry + backoff |
| `emergency-sell` | `QUEUE_EMERGENCY_SELL` | 20 | Manual brake sells | tx verify · pause market queue |
| `emergency-sweep` | `QUEUE_EMERGENCY_SWEEP` | 10 | Native sweep post-sell | parallel with sell |
| `consolidate-sell` | `QUEUE_CONSOLIDATE_SELL` | 20 | Treasury token sell | on-chain verify |
| `consolidate-sweep` | `QUEUE_CONSOLIDATE_SWEEP` | 10 | Native to staging | — |
| `consolidate-transfer` | `QUEUE_CONSOLIDATE_TRANSFER` | 5 | Final destination | Redis lock global |
| `lifecycle-drain` | `QUEUE_LIFECYCLE_DRAIN` | 1 | Full system drain | → rearm queue chain |
| `lifecycle-rearm` | `QUEUE_LIFECYCLE_REARM` | 1 | New wallets + fund | wait top-up |

> **Worker:** `npm run start:worker` — همه `@Processor`ها در `AppModule` load می‌شوند (`src/worker.ts`).

### 9.7 Redis Cache Keys & Locks

| Key Pattern | TTL | Purpose |
|-------------|-----|---------|
| `rpc:balance:{network}:{address}` | 5s | Balance cache · invalidate قبل از trade |
| `token:info:{network}:{address}` | 3s | GMGN metrics hot cache |
| `launchpad:score:{network}` | 60s | Best launchpad ranking |
| `gmgn:security:{chain}:{address}` | 300s | GMGN security result cache |
| `native:usd:prices` | — | SOL/BNB/ETH USD |
| `native:usd:last-good:{asset}` | — | Fallback price |
| `settings:current` | 60s | Settings hot reload |
| `cycle:{id}:state` | — | Active cycle state |
| `token:launch:lock:{cycleId}` | 300s | Double-launch prevention |
| `token:launch:pending:{cycleId}` | 3600s | Crash recovery mid-launch |
| `trend:generate:lock:{cycleId}` | 600s | Double trend generation |
| `market:wallet-state:{sessionId}` | 7200s | Wallet cooldown/trade count |
| `market:tick:lock:{sessionId}` | 120s | Single tick at a time |
| `market:tick:failures:{sessionId}` | 3600s | Backoff counter |
| `market:strategy-state:{sessionId}` | 7200s | Blitz phase state |
| `market:snapshot:last:{sessionId}` | 7200s | Last metrics snapshot |
| `market:trade:pending:{sessionId}:{txHash}` | 3600s | Idempotent trade persist |
| `profit:extract:lock:{cycleId}` | 600s | Single profit job per cycle |
| `emergency:brake:lock` | 600s | Global brake mutex |
| `treasury:consolidate:lock` | 900s | Consolidate mutex |
| `treasury:lifecycle:lock:{jobId}` | 7200s | Lifecycle job mutex |
| `fourmeme:access:{address}` | — | FourMeme auth token cache |

**منبع کد:** `src/common/redis/redis.keys.ts`

### 9.8 Performance & Profitability Design Principles

| اصل | پیاده‌سازی NestJS | تأثیر بر سود |
|-----|-------------------|-------------|
| **Parallel TX** | BullMQ `market-making` queue با concurrency 50 | ~100 trade/min |
| **RPC Pool** | Multiple RPC endpoints + round-robin + failover | Zero downtime |
| **Batch Funding** | ChangeNOW parallel + native transfer pipeline | Fast wallet seed |
| **Launchpad Scoring** | Real-time GMGN + LP data → pick hottest pad | Max organic inflow |
| **Security Gate** | GMGN `/v1/token/security` + score 0–100 | External buyers trust |
| **Min Gas** | Priority fee optimizer per network | Lowest cost/trade |
| **Trend AI** | OpenAI viral naming → max discoverability | Bot + human attraction |
| **Metric Loop** | TokenInfo polling 1s during market making | Hit $50K MC target |
| **Capital Guard** | Main wallet low-balance → pause + TG alert | Protect principal |
| **Proxy Layer** | Global HttpModule + ProxyAgent | Avoid IP bans |

---

## 10. ERD — Entity Relationship Diagram

### 10.1 دیاگرام (Mermaid)

```mermaid
erDiagram
    SETTINGS ||--o{ CYCLE : configures
    SETTINGS {
        uuid id PK
        string cron_expression
        json network_priority
        decimal max_investment_usd
        decimal min_trade_amount_usd
        decimal min_market_cap_usd
        decimal min_liquidity_usd
        int market_wallet_count
        enum market_wallet_usage_mode
        int security_min_score
        json integrations_encrypted
        json proxy_config
        json telegram_config
        timestamp updated_at
    }

    CYCLE ||--o| TREND_PACKAGE : generates
    CYCLE ||--o| TOKEN : launches
    CYCLE ||--o{ WALLET : creates
    CYCLE ||--o| MARKET_SESSION : runs
    CYCLE ||--o{ CYCLE_LOG : logs
    CYCLE ||--o{ FUNDING_TRANSACTION : funds
    CYCLE {
        uuid id PK
        enum status
        enum network
        enum launchpad
        uuid settings_id FK
        decimal net_profit_usd
        decimal external_inflow_usd
        timestamp started_at
        timestamp completed_at
    }

    TREND_PACKAGE {
        uuid id PK
        uuid cycle_id FK
        string name
        string symbol
        text description
        string logo_url
        string trend_topic
        string ai_model
        timestamp created_at
    }

    WALLET ||--o{ TRADE : executes
    WALLET ||--o{ FUNDING_TRANSACTION : receives
    WALLET {
        uuid id PK
        uuid cycle_id FK
        enum network
        enum type
        enum usage_mode
        string address
        string encrypted_private_key
        decimal balance_native
        decimal balance_usd
        boolean is_active
        boolean is_single_use_consumed
        uuid token_id FK
        timestamp created_at
    }

    TOKEN ||--o{ TOKEN_METRIC_SNAPSHOT : tracks
    TOKEN ||--o| SECURITY_REPORT : has
    TOKEN ||--o{ LIQUIDITY_SNAPSHOT : monitors
    TOKEN {
        uuid id PK
        uuid cycle_id FK
        uuid owner_wallet_id FK
        uuid liquidity_wallet_id FK "CUSTOM_RAYDIUM only"
        string address
        string name
        string symbol
        enum network
        enum launchpad
        string launch_tx_hash
        timestamp launched_at
        decimal total_supply "CUSTOM_RAYDIUM"
        int decimals "CUSTOM_RAYDIUM"
        string pool_address "CUSTOM_RAYDIUM — Raydium CPMM"
        string lp_mint "CUSTOM_RAYDIUM"
        string pool_tx_hash "CUSTOM_RAYDIUM"
        timestamp liquidity_locked_at "CUSTOM_RAYDIUM"
        timestamp liquidity_unlocked_at "CUSTOM_RAYDIUM — set by handbrake/drain"
    }

    MARKET_SESSION ||--o{ TRADE : contains
    MARKET_SESSION {
        uuid id PK
        uuid cycle_id FK
        uuid token_id FK
        enum status
        int trades_executed
        decimal trades_per_minute
        decimal target_market_cap_usd
        decimal achieved_market_cap_usd
        decimal volume_usd
        decimal gas_spent_usd
        timestamp started_at
        timestamp stopped_at
    }

    TRADE {
        uuid id PK
        uuid session_id FK
        uuid wallet_id FK
        uuid token_id FK
        enum side
        enum network
        decimal amount_token
        decimal amount_native
        decimal price_usd
        string tx_hash
        decimal gas_fee_usd
        int latency_ms
        timestamp executed_at
    }

    TOKEN_METRIC_SNAPSHOT {
        uuid id PK
        uuid token_id FK
        decimal market_cap_usd
        decimal volume_usd
        decimal liquidity_usd
        int buy_count
        int sell_count
        enum sentiment
        decimal price_usd
        timestamp captured_at
    }

    LIQUIDITY_SNAPSHOT {
        uuid id PK
        uuid token_id FK
        enum launchpad
        string market
        string pool_address
        decimal liquidity_usd
        timestamp captured_at
    }

    SECURITY_REPORT {
        uuid id PK
        uuid token_id FK
        int score
        boolean is_safe
        json risks
        string provider
        timestamp checked_at
    }

    FUNDING_TRANSACTION {
        uuid id PK
        uuid cycle_id FK
        uuid wallet_id FK
        enum source_asset
        enum target_network
        decimal amount_usd
        string changenow_order_id
        string native_transfer_tx_hash
        enum status
        timestamp created_at
    }

    MAIN_FEE_WALLET ||--o{ MAIN_WALLET_LEDGER : records
    MAIN_FEE_WALLET {
        uuid id PK
        string solana_address
        string bsc_address
        decimal balance_sol
        decimal balance_bnb
        decimal balance_usdc
        decimal total_usd
        decimal low_balance_threshold_usd
        timestamp updated_at
    }

    MAIN_WALLET_LEDGER {
        uuid id PK
        uuid main_wallet_id FK
        enum direction
        enum asset
        decimal amount
        decimal amount_usd
        string tx_hash
        string reference_type
        uuid reference_id
        timestamp created_at
    }

    TELEGRAM_LOG {
        uuid id PK
        uuid cycle_id FK
        string chat_id
        enum event_type
        text message
        boolean delivered
        timestamp sent_at
    }

    CYCLE_LOG {
        uuid id PK
        uuid cycle_id FK
        enum step
        enum level
        text message
        json metadata
        timestamp created_at
    }

    LAUNCHPAD_SCORE {
        uuid id PK
        enum network
        enum launchpad
        decimal score
        json metrics
        timestamp scored_at
    }
```

### 10.2 Prisma Schema (خلاصه)

```prisma
enum Network { SOLANA BSC }
enum Launchpad { PUMP_FUN FOUR_MEME LETS_BONK CUSTOM_RAYDIUM }
enum WalletType { TOKEN_OWNER MARKET LIQUIDITY }
enum WalletUsageMode { SINGLE_USE MULTI_USE }
enum CycleStatus { PENDING TREND_GENERATION LAUNCHPAD_SELECTION WALLET_GENERATION SECURITY_CHECK FUNDING TOKEN_LAUNCH MARKET_MAKING MONITORING COMPLETED FAILED ABORTED }
enum TradeSide { BUY SELL }
enum MarketSessionStatus { RUNNING STOPPED COMPLETED FAILED }

model Settings { id String @id @default(uuid()) /* ... */ cycles Cycle[] }
model Cycle { id String @id @default(uuid()) status CycleStatus wallets Wallet[] token Token? trendPackage TrendPackage? marketSession MarketSession? }
model Wallet { id String @id @default(uuid()) cycleId String cycle Cycle @relation(...) type WalletType usageMode WalletUsageMode encryptedPrivateKey String trades Trade[] }
model Token { id String @id @default(uuid()) address String @unique network Network launchpad Launchpad ownerWalletId String metrics TokenMetricSnapshot[] }
model MarketSession { id String @id @default(uuid()) trades Trade[] tradesExecuted Int @default(0) }
model Trade { id String @id @default(uuid()) side TradeSide txHash String latencyMs Int }
// ... remaining models per ERD above
```

### 10.3 Indexes (Performance)

| Table | Index | Reason |
|-------|-------|--------|
| `wallets` | `(cycle_id, type)` | Batch wallet lookup |
| `trades` | `(session_id, executed_at)` | Throughput metrics |
| `token_metric_snapshots` | `(token_id, captured_at DESC)` | Latest metrics |
| `cycles` | `(status, started_at)` | Active cycle queries |
| `funding_transactions` | `(cycle_id, status)` | Funding pipeline |
| `launchpad_scores` | `(network, scored_at DESC)` | Launchpad selection |

---

## 11. APIهای خارجی — External Integrations

> **مستند کامل endpoint به endpoint:** `docs/external-integrations.md`  
> تمام clientها از `ProxyModule` عبور می‌کنند. Retry: exponential backoff 3×. Timeout: 10s (RPC: 5s).

### 11.1 تغییرات v2.2

| قبل | الان |
|-----|------|
| GoPlus Security | **حذف** → GMGN `GET /v1/token/security` + score 0–100 |
| GMGN URL | `https://openapi.gmgn.ai` (نه `gmgn.ai/api`) |
| Pump.fun | Frontend API v3 + PumpPortal `trade-local` + on-chain SDK |
| FourMeme | 6-step REST + `TokenManager2` on-chain |
| LetsBonk | Raydium LaunchLab on-chain (REST رسمی ندارد) |
| ChangeNOW | v1 + v2 full flow + status lifecycle |

### 11.2 Integration Map

| Integration | Create | Buy/Sell | Data/Security |
|-------------|--------|----------|---------------|
| **GMGN** | `/v1/cooking/create_token` | `swap`, `multiSwap` | `/token/security`, `/info`, `/pool_info` |
| **ChangeNOW** | — | cross-chain swap | `/exchange/estimated-amount` |
| **Pump.fun** | `createV2Instruction` + API v3 | PumpPortal or SDK | bonding curve state |
| **FourMeme** | API → `createToken()` | `buyToken`/`sellToken` | Helper3 `getTokenInfo` |
| **LetsBonk** | Raydium `createLaunchpad` | SDK buy/sell | GMGN pool_info |

### 11.3 GMGN — مرکز یکپارچه‌سازی

```
openapi.gmgn.ai
  ├── SecurityCheck     → GET /v1/token/security + score algorithm
  ├── TokenInfo         → GET /v1/token/info
  ├── LiquidityAnalyzer → GET /v1/token/pool_info
  ├── Launchpad Score   → GET /v1/market/rank
  └── Market Making     → POST /v1/trade/multi_swap (200 wallets)
```

Auth: `X-APIKEY` (read) | `X-APIKEY` + `X-Signature` (trade — needs `GMGN_PRIVATE_KEY`)

### 11.4 ChangeNOW — Funding (خلاصه)

```
GET  /v2/exchange/currencies → GET /v2/exchange/estimated-amount
POST /v2/exchange → SEND deposit → GET /v2/exchange/by-id/{id} (poll)
Status: new → waiting → confirming → exchanging → sending → finished
```

### 11.5 Launchpads — Create (خلاصه)

| Pad | Method | Detail in docs |
|-----|--------|----------------|
| Pump.fun | IPFS + `createV2Instruction` | external-integrations.md §4 |
| FourMeme | 6-step API + `TokenManager2` | external-integrations.md §5 |
| LetsBonk | Raydium LaunchLab SDK | external-integrations.md §6 |

### 11.6 RPC / Explorer / Telegram / Proxy

بدون تغییر — Solana RPC, BSC RPC, SolanaScan, Etherscan v2, Telegram Bot API, Proxy Layer.

### 11.7 Performance Matrix

| Integration | Latency | Cache | Parallel | Path |
|-------------|---------|-------|----------|------|
| Pump.fun trade | 200ms | No | 50 | Market Making |
| FourMeme trade | 300ms | No | 50 | Market Making |
| LetsBonk trade | 200ms | No | 50 | Market Making |
| GMGN read | 150ms | 3–300s | Yes | Security + Info |
| GMGN multiSwap | 500ms | No | 200 | Market Making alt |
| ChangeNOW | 30–120s | No | 20 | Funding |
| OpenAI Trend | 5–6s | No | parallel | Trend Finder |

---

## 12. OpenAPI — REST API Specification

> Spec زنده: **`GET /docs-json`** (OpenAPI 3.0 از NestJS)

### 12.1 Endpoint Summary

| Method | Path | Module | Description |
|--------|------|--------|-------------|
| GET | `/settings` | Settings | دریافت تنظیمات |
| PATCH | `/settings` | Settings | بروزرسانی تنظیمات |
| POST | `/settings/proxy/test` | Settings | تست پروکسی |
| GET | `/core-trigger/cycles` | CoreTrigger | لیست چرخه‌ها |
| POST | `/core-trigger/cycles` | CoreTrigger | شروع دستی چرخه |
| GET | `/core-trigger/cycles/{id}` | CoreTrigger | جزئیات چرخه + PnL |
| POST | `/core-trigger/cycles/{id}/abort` | CoreTrigger | لغو چرخه |
| GET | `/wallets` | WalletGenerator | لیست ولت‌ها |
| POST | `/wallets` | WalletGenerator | تولید batch ولت |
| GET | `/wallets/{id}` | WalletGenerator | جزئیات ولت |
| GET | `/wallets/{id}/balance` | WalletGenerator | موجودی لحظه‌ای |
| GET | `/main-fee-wallet` | MainFeeWallet | وضعیت ولت اصلی |
| POST | `/main-fee-wallet/fund` | MainFeeWallet | تأمین وجه ولت‌ها |
| POST | `/trend-finder/generate` | TrendFinder | تولید ترند |
| GET | `/token-factory/launchpads/best` | TokenFactory | بهترین لانچ‌پد |
| POST | `/token-factory/launch` | TokenFactory | لانچ توکن |
| POST | `/market-generator/start` | MarketGenerator | شروع market making |
| GET | `/market-generator/sessions/{id}` | MarketGenerator | متریک session |
| POST | `/market-generator/sessions/{id}/stop` | MarketGenerator | توقف session |
| GET | `/liquidity/{address}` | LiquidityAnalyzer | تحلیل LP |
| GET | `/token-info/{address}` | TokenInfo | متریک‌های توکن |
| POST | `/security/check` | SecurityCheck | بررسی امنیت |
| POST | `/telegram/test` | Telegram | تست نوتیفیکیشن |
| POST | `/emergency/brake` | Emergency | ترمز — sell + sweep + **system halt** (§17) |
| GET | `/emergency/brake/{jobId}` | Emergency | وضعیت job ترمز |
| GET | `/emergency/halt` | Emergency | آیا سیستم halt است؟ |
| POST | `/emergency/resume` | Emergency | resume بعد از brake — unblock cycles |
| POST | `/treasury/consolidate` | TreasuryConsolidator | تجمیع SOL+BSC → آدرس مقصد (§21) |
| GET | `/treasury/consolidate/{jobId}` | TreasuryConsolidator | وضعیت job تجمیع |
| POST | `/treasury/drain` | TreasuryLifecycle | خالی کامل → Main Fee Wallet (§22) |
| POST | `/treasury/rearm` | TreasuryLifecycle | ولت جدید/بازاستفاده + fund (§22) |
| POST | `/treasury/lifecycle/run` | TreasuryLifecycle | drain + rearm یک‌کلیکی (§22) |
| GET | `/treasury/lifecycle/{jobId}` | TreasuryLifecycle | وضعیت چرخه |
| POST | `/profit-extractor/run` | ProfitExtractor | استخراج سود — creator trim / market TWAP (§18) |
| GET | `/profit-extractor/status/{cycleId}` | ProfitExtractor | `ownerHeldPercent` · `marketHeldPercent` · `capAppliesTo` |
| GET | `/profit-extractor/logs` | ProfitExtractor | تاریخچه extraction |
| GET | `/health` | — | Health check |

### 12.2 Authentication
- Header: `X-API-Key: {admin_api_key}`
- Health endpoint: public

### 12.3 Swagger Setup (NestJS)

```typescript
// main.ts
const config = new DocumentBuilder()
  .setTitle('Token Market Making Platform')
  .setVersion('1.0')
  .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'ApiKeyAuth')
  .build();
const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('docs', app, document);
// Raw spec: GET /docs-json or GET /docs-yaml
```

---

## 13. Profitability Flow — مسیر سود

> **مدل ریاضی کامل:** §19 — **Blitz Protocol:** +500% + LP max + Vol $100K — **همه زیر ۵ دقیقه**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PROFIT GENERATION PIPELINE                        │
└─────────────────────────────────────────────────────────────────────────┘

  [1] AI Trend Identity          →  Max visibility (viral name/logo)
           │
  [2] Best Launchpad Selection   →  Highest organic traffic pad (GMGN score)
           │
  [3] 100-200 Market Wallets     →  Volume + MC inflation engine
           │
  [4] Security Gate (GMGN ≥ 70)  →  External bots/buyers see "safe" token
           │
  [5] Fast Funding (ChangeNOW)   →  Wallets ready in < 2 min
           │
  [6] Token Launch               →  Live on Pump.fun / FourMeme / LetsBonk
           │
  [7] BLITZ HFT (<5min)         →  +500% | LP 95% | Vol $100K+ | MC $50K
           │
  [8] Organic Inflow             →  Real buyers + sniper bots attracted
           │
  [9] Capital Increase           →  Net profit > gas + swap fees
           │
  [9b] Profit Extract    →  OWNER_TRIM (creator>10%) · MARKET_TWAP (green) → Main Fee
           │
  [10] Telegram PnL Report       →  Full transparency per cycle
           │
  [11] Cron Repeat               →  Every N hours (settings.cronExpression)
```

| مرحله | هزینه | درآمد | Net |
|-------|-------|-------|-----|
| Trend AI | ~$0.05 | — | -$0.05 |
| Token Launch | ~$2 gas | — | -$2 |
| ~540 Trades (120/min × 4.5m) | ~$6–18 gas | ΔP +500%, LP max, Vol $100K | **Blitz target** |
| Organic Inflow | — | External buys | **+$profit** |
| **Cycle Total** | **~$20 max** | **MC $50K+ attracts real capital** | **Positive ROI** |

---

## 14. Deployment

```yaml
# docker-compose.yml (production layout)
services:
  app:
    build: .
    ports: ["5420:5420"]          # PORT default 5420
    depends_on: [postgres, redis]
    environment:
      PORT: 5420
      API_KEY: ${API_KEY}
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/token_platform
      REDIS_URL: redis://redis:6379
      KMS_KEY: ${KMS_KEY}          # 32-byte hex — wallet encryption
  worker:
    build: .
    command: node dist/worker.js
    deploy:
      replicas: 2                  # scale for market-making concurrency
    depends_on: [postgres, redis]
    environment:
      DATABASE_URL: ...
      REDIS_URL: ...
      KMS_KEY: ...
  postgres:
    image: postgres:16-alpine
  redis:
    image: redis:7-alpine
```

| Process | Instances | Role | الزامی؟ |
|---------|-----------|------|---------|
| `app` (API) | 1–2 | REST · Swagger · Cron scheduler (`CoreTriggerScheduler`) | ✅ |
| `worker` | **2–4** | BullMQ: funding · market · profit · emergency · treasury | ✅ **بدون worker سیستم freeze می‌شود** |
| `postgres` | 1 | Persistence · Prisma | ✅ |
| `redis` | 1 | Cache + BullMQ backend | ✅ |

### 14.1 Bootstrap sequence (اولین deploy)

```bash
# 1. Infrastructure
docker compose up -d postgres redis

# 2. Schema + seed
npm install                    # postinstall → prisma generate
npx prisma migrate deploy
npm run prisma:seed            # settings defaults از docs/settings.defaults.json

# 3. Build
npm run build
npm run validate:integrations
npm test

# 4. Runtime (دو terminal یا docker compose up app worker)
npm run start:prod             # API :5420
npm run start:worker           # BullMQ processors

# 5. Settings live keys (نه .env)
curl -X PATCH localhost:5420/api/v1/settings \
  -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  -d @your-production-settings.json

# 6. Health
curl -s localhost:5420/api/v1/health | jq
curl -s localhost:5420/api/v1/integrations/health | jq
```

> جزئیات گام‌به‌گام: §25 Runbook

---

## 15. Environment Variables — فقط زیرساخت

> **مهم:** API Key، RPC، Telegram، Proxy در `.env` **نیست** — همه از **Settings API** / DB.  
> Seed دمو: `docs/settings.defaults.json`

```env
# ─── Infrastructure ONLY ───
PORT=5420
NODE_ENV=production
API_KEY=your-admin-api-key-for-rest

DATABASE_URL=postgresql://user:pass@localhost:5432/token_platform
REDIS_URL=redis://localhost:6379
KMS_KEY=32-byte-hex-key-for-wallet-encryption

# ─── NOT in .env — use PATCH /settings ───
# openaiApiKey, gmgnApiKey, changeNowApiKey, solanaRpcUrl, evmRpcUrl,
# etherscanApiKey, solanaScanApiKey, telegram, proxy.url
```

### Bootstrap (اولین اجرا)

```typescript
// settings.seed.ts — if no settings row exists
const defaults = JSON.parse(readFileSync('docs/settings.defaults.json'));
await settingsRepo.upsert({ ...defaults, integrations: encrypt(defaults.integrations) });
```

---

## 16. Trend Finder — مستند فنی کامل

### 16.1 اصل طراحی

Trend Finder **۴ خروجی جدا** تولید می‌کند — هر کدام یک **API call مستقل** به OpenAI:

| Step | Output | Model | Parallel |
|------|--------|-------|----------|
| 1 | `trendTopic` | gpt-4o | — (اول اجرا می‌شود) |
| 2 | `name` + `symbol` | gpt-4o | بعد از Step 1 |
| 3 | `description` | gpt-4o | بعد از Step 2 |
| 4 | `logo` (PNG 1024×1024) | gpt-image-2 | **موازی با Step 3** |

```
Step 1 (Topic)
      │
      ├──► Step 2 (Name + Symbol)
      │         │
      │         ├──► Step 3 (Description) ──┐
      │         │                              ├──► Step 5: Validate + Save TrendPackage
      │         └──► Step 4 (Logo) ────────────┘
      │              (parallel with Step 3)
```

### 16.2 NestJS Service Flow

```typescript
// trend-finder.service.ts — pseudo
async generate(dto: TrendGenerateDto): Promise<TrendPackage> {
  const topic = await this.step1_discoverTopic(dto.network, dto.style);
  const { name, symbol } = await this.step2_generateIdentity(topic);
  const [description, logoBuffer] = await Promise.all([
    this.step3_generateDescription(topic, name, symbol),
    this.step4_generateLogo(topic, name, symbol),
  ]);
  const validated = this.validator.validate({ name, symbol, description });
  const logoUrl = await this.storage.upload(logoBuffer); // S3/MinIO
  return this.repo.save({ topic, name, symbol, description, logoUrl, ...validated });
}
```

### 16.3 Step 1 — Trend Topic Discovery

**Model:** `gpt-4o` | **Temperature:** `1.0` | **Response:** JSON

**System Prompt:**
```
You are a crypto meme-coin trend analyst. Your job is to pick ONE currently viral,
mass-appeal topic that crypto degens and normies both recognize RIGHT NOW.

Rules:
- Topic must feel instantly familiar (celebrity, meme, animal, political moment, viral TikTok, sports event, AI hype, etc.)
- Must be safe enough for a token name but edgy enough to go viral
- NO direct trademark infringement — parody/homage style only
- Prefer topics with active Twitter/X and Telegram chatter in the last 24–72 hours
- Output JSON only, no markdown

Output schema:
{
  "trendTopic": "string — 3–8 words",
  "viralAngle": "string — why this blows up now",
  "targetAudience": "string — degens | normies | both",
  "controversyLevel": "low | medium | high"
}
```

**User Prompt:**
```
Network: {{network}}  (SOLANA or BSC)
Style preference: {{style}}  (viral | controversial | meme)
Random seed: {{uuid}}  (forces variety each run)

Pick the single best trending topic for a new meme token launch today.
Be specific. Avoid generic topics like "AI" alone — name the exact meme or moment.
```

---

### 16.4 Step 2 — Name + Symbol (جدا از Description و Logo)

**Model:** `gpt-4o` | **Temperature:** `0.9` | **Response:** JSON

**System Prompt:**
```
You create meme coin NAME and TICKER SYMBOL for launchpads (Pump.fun, FourMeme, letsbonk).

Rules for NAME:
- 3–32 characters
- Memorable, punchy, sounds like a real launched coin
- Must clearly reference the trend topic
- Can use playful misspellings (doge-style)

Rules for SYMBOL:
- 3–8 uppercase letters A–Z only
- No numbers unless iconic (e.g. GPT)
- Must NOT duplicate famous tickers (BTC, ETH, SOL, BNB, DOGE, PEPE, TRUMP)
- Should be pronounceable

Output JSON only:
{
  "name": "string",
  "symbol": "string",
  "nameAlternatives": ["string", "string"],
  "symbolAlternatives": ["string", "string"]
}
```

**User Prompt:**
```
Trend topic: {{trendTopic}}
Viral angle: {{viralAngle}}
Network: {{network}}
Controversy level: {{controversyLevel}}

Generate the most clickable name and symbol for this trend.
The name should make someone stop scrolling. The symbol should look good on a chart.
```

**Validation (NestJS — قبل از Step 3):**
| Field | Rule |
|-------|------|
| `name` | length 3–32, no empty |
| `symbol` | regex `/^[A-Z]{3,8}$/` |
| duplicate check | query GMGN trending — reject if symbol collision on same network |

---

### 16.5 Step 3 — Description (جنجالی و ترند — جدا از Name/Symbol)

**Model:** `gpt-4o` | **Temperature:** `1.0` | **Max tokens:** 400

**System Prompt:**
```
You write meme coin DESCRIPTION text for launchpad metadata.

Tone: controversial, hype-driven, FOMO-inducing, slightly unhinged but not illegal.
Structure:
- Line 1: hook — why this is THE coin of the moment
- Line 2–3: trend tie-in — reference the viral topic explicitly
- Line 4: community call — "join", "don't miss", "generational entry"
- Optional: 1–2 relevant emoji max
- NO promises of guaranteed returns
- NO "official" claims for celebrities/brands
- Length: 120–280 characters (launchpad-friendly)

Output JSON:
{
  "description": "string",
  "hashtags": ["string"],
  "controversyHooks": ["string"]
}
```

**User Prompt:**
```
Token name: {{name}}
Symbol: ${{symbol}}
Trend topic: {{trendTopic}}
Viral angle: {{viralAngle}}
Controversy level: {{controversyLevel}}
Network: {{network}}

Write a description that makes CT (Crypto Twitter) share it.
Make it feel urgent and trending RIGHT NOW. Be bold.
```

---

### 16.6 Step 4 — Logo (۱:۱ — جدا — بر اساس Name/Symbol/Topic)

**Model:** `gpt-image-2` | **Size:** `1024x1024` | **Quality:** `high` | **Format:** `png`

**Prompt (single string — no system role in Images API):**
```
Meme coin logo, square 1:1, centered icon, no text, no letters, no watermark.

Subject: visual representation of "{{trendTopic}}" combined with "{{name}}" energy.
Style: bold flat vector OR glossy 3D meme coin aesthetic (random pick).
Colors: high contrast, neon or gold accents, crypto degen vibe.
Background: solid or simple gradient — must read clearly at 64×64 px favicon size.
Reference mood: Pump.fun / Bonk / Pepe tier meme coin quality.
Avoid: realistic human faces of real celebrities, copyrighted characters, text overlays.
```

**Post-processing (NestJS `LogoGeneratorService`):**
1. Decode PNG bytes from OpenAI `b64_json` response (no ephemeral URL download)
2. Compute SHA-256 hash and reject duplicate logos within 24h (Redis `logo:hash:{sha256}`)
3. Reject permanently registered duplicate hashes (Postgres registry)
4. Upload to S3/MinIO or local API store → `logoUrl`

---

### 16.7 TrendPackage Entity (DB)

```typescript
interface TrendPackage {
  id: string;
  cycleId?: string;
  trendTopic: string;
  viralAngle: string;
  controversyLevel: 'low' | 'medium' | 'high';
  name: string;
  symbol: string;
  description: string;
  hashtags: string[];
  logoUrl: string;
  logoHash: string;
  aiModelText: 'gpt-4o';
  aiModelImage: 'gpt-image-2';
  generationLatencyMs: number;
  createdAt: Date;
}
```

### 16.8 API Endpoint

```
POST /api/v1/trend-finder/generate
Body: { "network": "SOLANA", "style": "controversial" }
Response 201: TrendPackage (full object above)
Errors:
  422 — validation failed (bad symbol, duplicate)
  502 — OpenAI timeout (retry 1× then fail cycle step)
```

### 16.9 Settings مرتبط

| Key | Default | Description |
|-----|---------|-------------|
| `openaiModelText` | `gpt-4o` | Model for steps 1–3 |
| `openaiModelImage` | `runtime.openai.imageModel` (`gpt-image-2`) | Model for step 4 |
| `trendStyleDefault` | `viral` | viral \| controversial \| meme |
| `trendControversyMax` | `high` | سقف controversyLevel |
| `trendLogoQuality` | `hd` | standard \| hd |

### 16.10 Cost & Latency (per cycle)

| Step | Cost | Latency |
|------|------|---------|
| Step 1 | ~$0.01 | ~1.5s |
| Step 2 | ~$0.01 | ~1.5s |
| Step 3 | ~$0.01 | ~1.5s |
| Step 4 | ~$0.04 | ~8s (parallel with 3) |
| **Total** | **~$0.07** | **~5–6s** (steps 3+4 parallel) |

---

## 17. Manual Brake — مستند فنی کامل (تخلیه اضطراری)

### 17.1 هدف

در شرایط بحرانی (rug pull incoming، exploit، نقدینگی ناگهانی، دستور اپراتور):
- **توقف فوری** market making
- **فروش ۱۰۰٪** توکن در **هر ولتی** که balance > 0 دارد
- **Sweep** تمام SOL/BNB/USDC باقی‌مانده به **Main Fee Wallet**
- **گزارش Telegram** با جزئیات کامل

### 17.2 Trigger

| روش | Endpoint / Event |
|-----|------------------|
| دستی API | `POST /api/v1/emergency/brake` |
| Admin Panel | دکمه «ترمز اضطراری» |
| Optional auto | `settings.autoBrakeOnLiquidityDrop = true` + LP < threshold |

**Request Body:**
```json
{
  "scope": "CYCLE",
  "cycleId": "uuid",
  "convertTo": "NATIVE",
  "reason": "manual operator decision"
}
```

```json
{
  "scope": "GLOBAL",
  "convertTo": "NATIVE",
  "reason": "emergency shutdown all positions"
}
```

> `convertTo`: `NATIVE` (پیش‌فرض — سریع‌ترین sweep SOL/BNB) یا `USDC`. فیلد قدیمی `convertToUsdc` deprecated است.

### 17.3 فلو ۹ مرحله‌ای

```
[TRIGGER: POST /emergency/brake]
        │
        ▼
┌─────────────────────────────┐
│ 1. LOCK + SYSTEM HALT       │ Redis `emergency:brake:lock`
│    pause 4 BullMQ queues    │ market-making · cycle-orchestrator ·
│                             │ wallet-funding · profit-extract
│    Redis system:operational:halt │ block startCycle
│    cancel pending queued jobs   │
└─────────────┬───────────────┘
              ▼
┌─────────────────────────────┐
│ 2. STOP MARKET MAKING       │ همه sessionهای RUNNING → STOPPED (فوری)
│    BullMQ: drain queue      │ market-making queue paused
└─────────────┬───────────────┘
              ▼
┌─────────────────────────────┐
│ 3. ABORT CYCLES             │ cycle status → ABORTED (scope=CYCLE or ALL active)
└─────────────┬───────────────┘
              ▼
┌─────────────────────────────┐
│ 4. COLLECT WALLETS          │ SELECT * FROM wallets WHERE token_balance > 0
│                             │ شامل: TOKEN_OWNER + MARKET (100–200 ولت)
│                             │ scope=CYCLE → filter by cycleId
│                             │ scope=GLOBAL → all active cycles
└─────────────┬───────────────┘
              ▼
┌─────────────────────────────┐
│ 5. SELL ALL TOKENS          │ BullMQ queue: emergency-sell (concurrency: 20)
│    per wallet:              │
│    - Pump.fun / FourMeme /  │
│      LetsBonk sell 100%     │
│    - slippage: max 25%      │
│    - retry: 3× per wallet   │
└─────────────┬───────────────┘
              ▼
┌─────────────────────────────┐
│ 6. SWEEP NATIVE             │ انتقال SOL/BNB باقی‌مانده → Main Fee Wallet
│    (منهای reserve gas)     │ reserve: 0.001 SOL / 0.0005 BNB per wallet
└─────────────┬───────────────┘
              ▼
┌─────────────────────────────┐
│ 7. CONVERT (optional)       │ اگر convertToUsdc=true:
│                             │ ChangeNOW: native → USDC → Main Fee Wallet
└─────────────┬───────────────┘
              ▼
┌─────────────────────────────┐
│ 8. LEDGER + DB              │ emergency_brake_logs table
│                             │ main_wallet_ledger entries
│                             │ wallet.is_active = false
└─────────────┬───────────────┘
              ▼
┌─────────────────────────────┐
│ 9. TELEGRAM REPORT          │ خلاصه: wallets, tokens sold, USD recovered, failures
└─────────────────────────────┘
              ▼
         [UNLOCK — POST /emergency/resume clears halt]
```

> **روزمره استفاده نکن** — bot cascade و TWAP را قطع می‌کند. فقط panic.

### 17.4 Sell Logic per Wallet (NestJS)

```typescript
async sellWalletAll(wallet: Wallet, token: Token): Promise<SellResult> {
  const balance = await this.rpc.getTokenBalance(wallet.address, token.address);
  if (balance.lte(0)) return { skipped: true };

  const launchpad = this.launchpadFactory.get(token.launchpad);
  const tx = await launchpad.sell({
    wallet,
    tokenAddress: token.address,
    amount: balance,           // 100% — no partial
    slippageBps: 2500,         // 25% max — emergency accepts slippage
    priorityFee: 'high',      // speed over cost
  });

  await this.tradeRepo.save({ side: 'SELL', walletId: wallet.id, amount: balance, txHash: tx.hash, tag: 'EMERGENCY_BRAKE' });
  return { sold: balance, txHash: tx.hash, usdEstimate: tx.usdOut };
}
```

### 17.5 Parallel Execution

| Queue | Concurrency | Timeout |
|-------|-------------|---------|
| `emergency-sell` | 20 | 30s / wallet |
| `emergency-sweep` | 10 | 15s / wallet |

**SLA:** 200 wallet → sell + sweep در **< 90 ثانیه**

### 17.6 Telegram Report Template

```
🚨 EMERGENCY BRAKE EXECUTED

Scope: GLOBAL | Cycle: abc-123
Reason: manual operator decision
Duration: 87s

━━━ SELL SUMMARY ━━━
Wallets processed: 201
Tokens sold: 201/201 (100%)
Failed sells: 0

━━━ RECOVERY ━━━
SOL recovered: 45.2 (~$6,780)
BNB recovered: 0
USDC converted: $6,750
Total USD: $6,750

━━━ TOKEN ━━━
Name: {{name}} (${{symbol}})
Network: SOLANA
Launchpad: PUMP_FUN

━━━ FAILURES ━━━
(none)

Status: ✅ COMPLETE — all positions closed
```

### 17.7 DB — emergency_brake_logs

```sql
CREATE TABLE emergency_brake_logs (
  id            UUID PRIMARY KEY,
  scope         ENUM('CYCLE', 'GLOBAL'),
  cycle_id      UUID,
  reason        TEXT,
  wallets_total INT,
  wallets_sold  INT,
  wallets_failed INT,
  tokens_sold   DECIMAL,
  usd_recovered DECIMAL,
  duration_ms   INT,
  status        ENUM('RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED'),
  created_at    TIMESTAMP
);
```

### 17.8 OpenAPI

```
POST /api/v1/emergency/brake
Body: { "scope": "GLOBAL"|"CYCLE", "cycleId"?, "convertTo": "NATIVE"|"USDC" }
Response 202: { jobId, status: "QUEUED", walletsAffected: 201 }

GET  /api/v1/emergency/brake/{jobId}
Response 200: { status, progress, sellResults[], usdRecovered }

GET  /api/v1/emergency/halt
Response 200: { halted: boolean, reason?, haltedAt? }

POST /api/v1/emergency/resume
Response 200: { resumed: true }  — clears system halt · resumes queues
```

---

## 18. Profit Extractor — creator cap ۱۰٪ + market TWAP

### 18.1 قانون اصلی (v3)

> **`maxTokenHoldPercent` فقط روی TOKEN_OWNER (creator visible) اعمال می‌شود — نه کل supply سیستم.**

| wallet | نقش | سقف / رفتار |
|--------|-----|-------------|
| **TOKEN_OWNER** | dev wallet visible | **≤ 10%** supply (`maxTokenHoldPercent`) |
| **~200 MARKET** | position بزرگ · پخش‌شده | **TWAP** در سبز · **floor 20%** (`minMarketHoldPercent`) |
| **Main Fee** | SOL/BNB/USDC | **توکن launch نگه نمی‌دارد** |

```
Creator:   8%   ← scanner می‌بیند — بدون red flag
Market:   25%+  ← control غیرمستقیم · organic spread
────────────────
کل ما:   33%+  ← نه 10% — 10% فقط creator visible
```

وقتی **creator > 10%** → `OWNER_TRIM`. وقتی market در سبز و بالای floor → `MARKET_TWAP` → سود به Main Fee.

### 18.2 چرا این مدل؟

| دلیل | توضیح |
|------|-------|
| Creator کوچک | dev wallet ≤10% — bot/scanner red flag نمی‌زند |
| Market position | ۲۰۰ wallet · position بزرگ ولی پراکنده = organic |
| Lock profit | TWAP از market در momentum → Main Fee |
| Floor 20% | position حفظ — TWAP زیر 20% supply stop |

### 18.3 Scope محاسبه Holdings (split snapshot)

```
ownerHeldPercent  = TOKEN_OWNER balance / totalSupply × 100
marketHeldPercent = SUM(MARKET wallets) / totalSupply × 100
totalHeldPercent  = owner + market   (Main Fee excluded — no launch tokens)

capAppliesTo: "TOKEN_OWNER"

IF ownerHeldPercent > maxTokenHoldPercent (10)
  → sellMode: OWNER_TRIM (فقط از creator)

ELSE IF marketProfitTaking AND price green AND marketHeldPercent > minMarketHoldPercent (20)
  → sellMode: MARKET_TWAP (batch از market wallets)

IF marketHeldPercent ≤ minMarketHoldPercent (20)
  → stop MARKET_TWAP (floor)
```

### 18.4 استراتژی فروش (OWNER_TRIM + MARKET_TWAP)

```
MONITORING (each tick / scheduled)
        │
        ▼
  ownerHeldPercent > 10% ?
        │ YES → OWNER_TRIM از creator wallet
        │ NO
        ▼
  market TWAP enabled AND sellInRed=false ?
        │ priceChange5m < 0 → WAIT
        │ liquidity < min → WAIT
        │ marketHeldPercent ≤ 20% floor → STOP
        │ YES (green + above floor)
        ▼
  MARKET_TWAP batch
  sellAmount = min(excess_market × sellBatchRatio, maxSellBatchPercent × supply)
        │
        ▼
  on-chain sell (MARKET wallets · balance desc) → sweep → Main Fee
        │
        ▼
  Telegram profit report
```

### 18.5 Sell Logic (خلاصه کد)

```typescript
const snapshot = computeSplitHoldingSnapshot({ ownerHeld, marketHeld, supply, maxTokenHoldPercent });

if (snapshot.ownerHeldPercent > maxTokenHoldPercent) {
  return sellMode: 'OWNER_TRIM';  // creator wallet only
}

if (marketProfitTaking && !sellInRed && priceChange5m >= 0) {
  if (snapshot.marketHeldPercent <= minMarketHoldPercent) return STOP; // floor 20%
  return sellMode: 'MARKET_TWAP';  // market wallets · batch ratio from settings
}
```

### 18.6 Settings (v3 defaults)

| Key | Default | Description |
|-----|---------|-------------|
| `maxTokenHoldPercent` | `10` | سقف **فقط TOKEN_OWNER** (%) — `capAppliesTo: TOKEN_OWNER` |
| `strategy.profitExtract.minMarketHoldPercent` | `20` | floor market — TWAP زیر این stop |
| `strategy.profitExtract.marketProfitTaking` | `true` | TWAP از market wallets |
| `strategy.profitExtract.sellBatchRatio` | `0.10` | هر batch چند درصد excess market |
| `strategy.profitExtract.maxSellBatchPercent` | `1.5` | حداکثر batch نسبت به supply (%) |
| `strategy.profitExtract.sellInRed` | `false` | **هرگز true نکن** — فروش در ضرر |
| `strategy.profitExtract.sellBatchIntervalMinSec` | `45` | فاصله batch |
| `strategy.profitExtract.sellBatchIntervalMaxSec` | `180` | jitter max |

### 18.7 Timing — کی اجرا می‌شود؟

| Trigger | When |
|---------|------|
| **During MONITORING** | هر ۱۰ ثانیه — holdingPercent check |
| **Post Market Making** | بلافاصله بعد از session COMPLETED |
| **Cron** | هر ۱۵ دقیقه برای cycles فعال با token balance |
| **Manual** | `POST /api/v1/profit-extractor/run` |

### 18.8 Wallet Priority

| sellMode | از کدام ولت | شرط |
|----------|-------------|-----|
| **OWNER_TRIM** | TOKEN_OWNER فقط | `ownerHeldPercent > 10%` |
| **MARKET_TWAP** | MARKET (balance desc) | سبز · `marketHeldPercent > 20%` floor |
| **WAIT** | — | red · low liquidity · زیر floor |

> Main Fee Wallet توکن launch نگه نمی‌دارد — در scope نیست.

### 18.9 Telegram Profit Report

```
💰 PROFIT EXTRACTION

Token: {{name}} (${{symbol}})
Cycle: abc-123

━━━ HOLDINGS ━━━
Owner (creator): 11.2% → trim to ≤10%  [OWNER_TRIM]
Market wallets:  28.4% (floor 20% — TWAP active)
capAppliesTo: TOKEN_OWNER

━━━ PROCEEDS ━━━
Batch 1 (market TWAP): 8M tokens → 1.4 SOL ($210)
Total recovered: $210 → Main Fee Wallet

Strategy: MARKET_TWAP | Sell-in-red: NO
```

### 18.10 NestJS Module

```
src/modules/profit-extractor/
├── profit-extractor.module.ts
├── profit-extractor.service.ts       # run(), getStatus(), monitorActiveCycles()
├── profit-extractor.controller.ts    # POST /profit-extractor/run
├── holding-calculator.service.ts     # trade-ledger holdings · supply sources
├── token-supply.service.ts           # GMGN → launchpad → fallback supply
├── profit-sell-executor.service.ts   # on-chain sell + RPC verify + retry
├── profit-market-gate.service.ts     # shouldDeferProfitSell (price/liquidity/sentiment)
├── profit-extract.util.ts            # TWAP batch · tx hash validation
├── profit-extract.errors.ts          # typed errors (Holding · MarketWait · Sell)
└── processors/
    └── profit-sell.processor.ts      # BullMQ + Redis lock profit:extract:lock
```

### 18.11 DB — profit_extraction_logs

```sql
CREATE TABLE profit_extraction_logs (
  id                  UUID PRIMARY KEY,
  cycle_id            UUID REFERENCES cycles(id),
  token_id            UUID REFERENCES tokens(id),
  held_percent_before DECIMAL(5,2),
  held_percent_after  DECIMAL(5,2),
  tokens_sold         DECIMAL,
  usd_recovered       DECIMAL,
  tx_hash             TEXT,              -- comma-separated on-chain tx hashes
  batch_count         INT,
  strategy            VARCHAR(50),       -- default: TWAP
  created_at          TIMESTAMP
);
```

### 18.12 OpenAPI Endpoints

```
POST /api/v1/profit-extractor/run
Body: { "cycleId": "uuid", "force": false }
Response 202: { jobId, heldPercent, targetPercent, excessTokens, status }

GET  /api/v1/profit-extractor/status/{cycleId}
Response 200: {
  ownerHeldPercent, marketHeldPercent, totalHeldPercent,
  maxPercent, capAppliesTo: "TOKEN_OWNER",
  minMarketHoldPercent, marketProfitTaking,
  excessTokens, totalSupply, supplySource,
  lastExtractionAt, lastTxHash, tokenAddress
}
Response 200 (pending token): { status: "UNAVAILABLE", reason }

GET  /api/v1/profit-extractor/logs?cycleId=uuid
Response 200: { data: ProfitExtractionLog[], total, page, limit }
```

### 18.13 Integration با Core Trigger

```
MARKET_MAKING (step 7)
        │
        ▼
MONITORING (step 8)
        │
        ├── ProfitExtractorScheduler / monitorActiveCycles (cycles MONITORING|COMPLETED)
        ├── BullMQ profit-extract job per cycle (Redis lock — no duplicate)
        │       ├── holding-calculator: ledger-based held %
        │       ├── profit-market-gate: defer if red/low liquidity (unless force)
        │       ├── profit-sell-executor: on-chain sell + verify tx
        │       └── MainWalletLedger IN + tx_hash persist
        │
        ▼
COMPLETED (step 10)
        └── final extract check + Telegram PnL summary
```

### 18.14 Production Hardening (بدون شکاف)

| موضوع | رفتار production |
|-------|------------------|
| **Supply source** | GMGN totalSupply → launchpad RPC → conservative fallback · `supplySource` در status |
| **Holdings scope** | split: `ownerHeldPercent` · `marketHeldPercent` · Main Fee excluded |
| **Sell modes** | `OWNER_TRIM` (creator >10%) · `MARKET_TWAP` (green + above floor) |
| **Market floor** | `minMarketHoldPercent: 20` — stop TWAP below |
| **Market gate** | `shouldDeferProfitSell`: priceChange5m · buy/sell count · minLiquidity · sentiment |
| **On-chain verify** | `hasConfirmedTransaction` (SOL) / `hasSuccessfulTransaction` (BSC) قبل از ledger |
| **Idempotency** | duplicate txHash skip · Redis lock per cycle · ALREADY_QUEUED status |
| **Retry** | sell executor exponential backoff · max attempts از settings runtime |
| **Main fee credit** | `MainWalletLedger` IN با referenceId `{cycleId}:{firstTxHash}` |
| **Disabled** | `strategy.profitExtract.enabled=false` → run returns DISABLED |
| **Errors typed** | `ProfitExtractSellError` · `ProfitExtractMarketWaitError` · requeue با backoff |

---

## 19. Mathematical Market Strategy — مدل ریاضی، اقتصاد، و زیرساخت

> دید: ریاضی‌دان (بهینه‌سازی) + اقتصودان بازار (microstructure) + strategist (FOMO/virality)  
> **هدف سیستم:** MC، Volume، Liquidity، و جذب انسانی — **بیشینه** | هزینه عملیاتی — **کمینه**  
> **باند رشد هدف:** **+500% حداقل** — از لانچ تا T+5:00 (زیر ۵ دقیقه)  
> **همزمان:** LP بالا + Vol spike + MC > $50K → جذب فوری bots و مردم

---

### 19.0 Blitz Ignition Protocol — لانچ تا +500% زیر ۵ دقیقه

> **قانون طلایی:** MC، Volume، و Liquidity **باید همزمان** در یک پنجره **< 300 ثانیه** به سقف برسند — نه پشت سر هم.

```
T+0:00  TOKEN LIVE + Jito bundle (launch + 30 wallet buy same block)
T+0:45  200 wallets funded (ChangeNOW pre-staged — parallel 20)
T+1:00  ΔP +120%  |  Vol $15K  |  LP rising
T+2:30  ΔP +280%  |  Vol $45K  |  LP 70% max
T+4:00  ΔP +420%  |  Vol $75K  |  LP 90% max
T+4:59  ΔP ≥+500% |  Vol $100K+ |  LP MAX | MC ≥ $50K  ← HARD TARGET
T+5:00  → Phase 2 FOMO (bots + humans — جذب شروع)
```

**چرا زیر ۵ دقیقه critical:**

```
Attention_half_life ≈ 4–6 min on CT/DexScreener

IF ΔP+500% AND LP_max AND Vol_spike ALL within T < 5min:
  → P(bot_buy) → 0.95
  → P(human_FOMO) → 0.85
ELSE IF spread over 15min:
  → attention decay → P(bot) → 0.3  (missed window)
```

**سه محور همزمان (Triple Spike Constraint):**

```
At T = 4min59s MUST satisfy ALL:

  (1) ΔP/P ≥ 5.0          (500% growth)
  (2) LP/LP_max ≥ 0.95    (liquidity near maximum on curve)
  (3) Vol_5m ≥ $100,000   (volume spike visible on all charts)
  (4) MC ≥ $50,000        (trending threshold)

  J_blitz = min(ΔP/5, LP/LP_max, Vol/100K, MC/50K)  →  target J_blitz ≥ 1.0
```

---

### 19.1 مسئله بهینه‌سازی (Formal Problem)

```
maximize   J = w₁·MC + w₂·Vol + w₃·LP + w₄·N_org − λ·C_op

subject to:
  MC(t)     ≥ MC_min          (default: $50,000)
  Vol(t)    ≥ Vol_min         (maximize — no upper cap in ignition)
  LP(t)     ≥ LP_min
  Score_sec ≥ 70              (GMGN security gate)
  Hold_owner ≤ 0.10 · Supply   (creator cap — TOKEN_OWNER only)
  Hold_market ≥ 0.20 · Supply  (floor — TWAP stops below minMarketHoldPercent)
  C_op      ≤ Budget_cycle    (settings.maxInvestmentUsd)
  ΔP/P      ≥ 5.0           (500% HARD FLOOR — achieve by T+4:59)
  T_ignition ≤ 300 sec       (< 5 minutes from launch)
  LP(t)     ≥ 0.95 · LP_max (liquidity near max SIMULTANEOUS with ΔP)
  Vol_5m    ≥ $100,000       (at T+5min)
```

| نماد | معنی | واحد |
|------|------|------|
| `MC` | Market Cap | USD |
| `Vol` | Volume (rolling 5m / 24h) | USD |
| `LP` | Liquidity (pool depth) | USD |
| `N_org` | Organic buyer count (external wallets) | count |
| `C_op` | Operational cost (gas + swap + AI + funding) | USD |
| `w₁…w₄, λ` | وزن‌های استراتژی (قابل تنظیم Settings) | — |

**اصل بنیادین:** سود واقعی از **N_org** می‌آید — MC/Volume بالا فقط **جاذب** N_org است، نه خودِ سود.

---

### 19.2 مدل فازها — Phase Transition (چرا «یهو» مردم می‌آیند)

```
                    ORGANIC INFLOW (سود واقعی)
                           ▲
                           │ tipping point
              ─────────────┼──────────────  MC_critical ≈ $50K
                           │
         ┌─────────────────┴─────────────────┐
         │     PHASE 2: FOMO CASCADE        │  ← bots + humans pile in
         │     dMC/dt >> 0, N_org exponential│
         └─────────────────┬─────────────────┘
                           │
         ┌─────────────────┴─────────────────┐
         │  PHASE 1: BLITZ (< 5 min STRICT) │  ← T+0 → T+4:59
         │  ΔP ≥ +500% | LP MAX | Vol $100K+ │
         └─────────────────┬─────────────────┘
                           │
         ┌─────────────────┴─────────────────┐
         │  PHASE 0: LAUNCH (0–45 sec)        │  ← Jito bundle + live
         └───────────────────────────────────┘
```

**نقطه بحرانی (Tipping Point):**

```
MC_critical = f(LP, Vol_velocity, Score_sec, Trend_virality)

When MC > MC_critical AND dVol/dt > θ_vol:
  → P(inflow_organic) → 1
  → sniper bots + CT + GMGN trending → N_org jumps
```

| پارامتر | مقدار هدف Blitz | Settings key |
|---------|-----------------|--------------|
| `ΔP/P` | **≥ 5.0 (500%)** by T+4:59 | `targetPriceChangePercent: 500` |
| `T_ignition` | **< 300 sec** | `maxIgnitionDurationSeconds: 300` |
| `MC` | **≥ $50,000** | `minMarketCapUsd: 50000` |
| `Vol_5m` | **≥ $100,000** | `minVolume5mUsd: 100000` |
| `LP/LP_max` | **≥ 0.95** | `minLiquidityRatio: 0.95` |
| `f_trade` | **120/min** (540 in 4.5min) | `targetTradesPerMinute: 120` |
| Buy bias | **65% buy / 35% sell** (LP↑ + price↑) | `buyBiasPercent: 65` |

---

### 19.3 موتور HFT — ریاضی Volume و MC

**Bonding curve (Pump.fun / LaunchLab):** قیمت تابعی از supply فروخته‌شده:

```
P(s) = a · s^n     (simplified; actual curve from launchpad SDK)

MC = P(s) · S_total
Vol = Σ |trade_i| · P_i
```

**Blitz HFT — 500% + LP همزمان (< 5 min):**

```
N_wallets = 200
f_trade   = 120 trades/min
T_blitz   = 4.5 min (270 sec — 30s buffer before T+5 hard stop)
N_trades  = 120 × 4.5 = 540

Buy/Sell mix (LP + ΔP co-optimization):
  T+0:00 → T+2:00  : 80% BUY  → LP inject + price ramp
  T+2:00 → T+4:00  : 65% BUY  → LP↑ while pushing ΔP→500%
  T+4:00 → T+4:59  : 50/50     → Vol spike, LP hold ≥95%

LP on bonding curve: net BUY → LP↑ AND P↑ together
LiquidityAnalyzer every 2s → block sells if LP/LP_max < 0.90
```

**Cost per trade (minimize):**

```
C_trade ≈ gas_sol + slippage + pump_fee
        ≈ $0.002–0.03 per trade (Solana optimized)

C_ignition = 540 × $0.02 + $2 + $0.07 + ~$15 ≈ $28

With 540 trades, ΔP ≥500%, LP max, Vol $100K+ by T+4:59:
  η_target > 1500
```

---

### 19.4 کمترین هزینه — بیشترین MC/Volume/LP

| اهرم | مکانیزم | صرفه‌جویی |
|------|---------|----------|
| **Pre-fund wallets** | Fund during Trend Gen (parallel) | launch→trade **< 45s** |
| **Jito bundle T+0** | 30 wallet buy same block as launch | instant chart candle |
| **Batch funding** | ChangeNOW 20 parallel (pre-staged) | wallets ready before launch |
| **Buy bias 65–80%** | net BUY → LP↑ + P↑ together | triple spike |
| **LP guard** | block sell if LP/LP_max < 0.90 | liquidity never drops |
| **GMGN multiSwap** | 200 wallets one API call | API cost ÷200 |
| **Priority fee optimizer** | dynamic per network load | gas −30% |
| **Proxy rotation** | avoid IP ban → no retry waste | uptime 99.9% |
| **Security pre-gate** | GMGN score ≥70 once | no dead launches |
| **Profit extract** | creator cap 10% · market TWAP · floor 20% | lock profit, look organic |

**فرمول بودجه:**

```
Budget_min = C_launch + (N_wallets × fund_per_wallet) + (N_trades × C_trade_min)

fund_per_wallet ≈ $2–2.5 USDC via ChangeNOW (minTradeAmountUsd)
N_wallets = 201 (owner+200) → USDC principal ≈ $455 (می‌چرخد)
C_op burn ≈ $280–380 (ChangeNOW fee + ETH deposit gas + Blitz) — see cost-model.md
Total cap: settings.maxInvestmentUsd default **5000**

Rule: C_op ≤ 0.15 × Expected_organic_inflow  (Kelly-style safety margin)
```

---

### 19.5 جذب انسان — Virality Function V(t)

```
V(t) = α·TrendScore + β·ΔP/P + γ·Vol_spike + δ·Score_sec + ε·SmartMoney_signal

TrendScore  ← Trend Finder (OpenAI viral name/logo)
ΔP/P        ← **≥500% by T+4:59** (chart vertical = instant FOMO)
Vol_spike   ← **540 trades / 4.5 min** + Vol_5m ≥ $100K
LP_max      ← **≥95% LP_max** simultaneous with ΔP (not after)
Score_sec   ← GMGN ≥70
TrendScore  ← viral name/logo (pre-launch ready)
```

**چرا «یهو» جذب می‌شوند:**

| سیگنال | مخاطب | واکنش |
|--------|--------|-------|
| Chart **+500% in <5min** | Degens + CT | instant FOMO |
| Vol **$100K+ / 5m** | Sniper bots | auto-buy NOW |
| LP **near max** | Risk algos | "deep liquidity" pass |
| MC > $50K | GMGN trending | list = visibility |
| All **simultaneous** | Everyone | **attention window captured** |

**Infrastructure MUST deliver triple spike in T < 300s** — parallel not sequential.

---

### 19.6 Settings — پارامترهای ریاضی (تunable از Admin)

```json
{
  "strategy": {
    "mode": "BLITZ",
    "targetPriceChangePercent": 500,
    "maxIgnitionDurationSeconds": 300,
    "minMarketCapUsd": 50000,
    "minVolume5mUsd": 100000,
    "minLiquidityRatio": 0.95,
    "targetTradesPerMinute": 120,
    "ignitionDurationMinutes": 4.5,
    "buyBiasPercent": 65,
    "jitoBundleAtLaunch": true,
    "preFundWallets": true,
    "marketWalletCount": 200,
    "securityMinScore": 70,
    "maxTokenHoldPercent": 10
  }
}
```

**Adaptive tuning — Blitz (< 5 min hard deadline):**

```
At T+2:00 IF ΔP/P < 2.0 (200%):
  → f_trade → 150/min (emergency acceleration)
  → buyBias → 85%

At T+3:30 IF ΔP/P < 4.0 AND LP/LP_max < 0.90:
  → pause ALL sells for 30s (LP recovery)
  → burst buy only

At T+4:30 IF ΔP/P < 4.8:
  → final sprint: 200 trades in 30s (Jito bundle if Solana)

At T+4:59 IF J_blitz < 1.0:
  → log BLITZ_MISS → Telegram alert (do NOT extend past 5min)

At T+5:00 IF J_blitz ≥ 1.0:
  → Phase 2 → reduce internal trades → let organic dominate
```

---

### 19.7 زیرساخت — Mapping به اهداف ریاضی

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    INFRASTRUCTURE → MATHEMATICAL GOAL                      │
└─────────────────────────────────────────────────────────────────────────┘

 Trend Finder (§16)          → max V(t) trend component
 Launchpad Selector          → max P(launchpad) × traffic (GMGN rank)
 Wallet Generator 200×       → N_wallets for Vol = f_trade × T
 ChangeNOW pre-fund (parallel)  → wallets ready T+0:45
 Jito bundle T+0               → 30 wallets + launch same block
 Market Generator 120/min       → ΔP≥500% + LP_max by T+4:59
 Liquidity Analyzer 2s         → LP guard — block sell if LP drops
 GMGN TokenInfo 1s poll         → closed-loop Blitz controller
 Profit Extractor (creator + market TWAP) → lock profit without killing chart
 Telegram PnL                → operator visibility → faster decisions
 BullMQ 50 workers           → min C_trade (parallel = less timeout retry)
 Redis hot cache             → min API latency → faster loop
 Settings (no hardcode)      → live tune weights without redeploy
```

**Feedback loop (control theory):**

```
         ┌──────────┐
 setpoint│ ΔP≥500% by T+4:59│
         │ LP≥95% LP_max    │
         │ Vol≥$100K / 5m   │
         │ MC≥$50K          │
         └────┬─────┘
              ▼
    ┌─────────────────┐     every 1s      ┌──────────────┐
    │ Market Generator│ ◄──────────────── │ TokenInfo    │
    │ (adjust f_trade)│ ────────────────► │ (GMGN)       │
    └─────────────────┘     MC, Vol, ΔP   └──────────────┘
              │
              ▼
    IF error = setpoint − actual > ε  →  increase aggression
    IF overshoot ΔP > 500%            →  reduce buy bias
```

---

### 19.8 Game Theory — چرا bots و humans بعد از Ignition می‌خرند

```
Player types:
  - Sniper bots:  buy if MC > threshold AND score > 70 AND vol_velocity > θ
  - Degens:       buy if chart looks vertical AND name is trending
  - Smart money:  buy if smart_wallets ≥ 3 on GMGN

Our move (Phase 1):  artificially create ALL signals bots watch
Their move (Phase 2):  buy → price up → more bots → cascade

Nash equilibrium for us:
  Invest C_op ~ $280–380 → create signal bundle worth MC $50K+ visible
  Expected organic inflow E[Inflow] >> C_op when signals align (12/12 GREEN)

  E[Profit] = E[Inflow] − C_op − E[gas_exit]
```

**Risk cap:** Creator visible ≤10% (`capAppliesTo: TOKEN_OWNER`) — bots don't flag dev dump. Market position spread across 200 wallets looks organic.

---

### 19.9 Timeline Blitz — زیر ۵ دقیقه (STRICT)

| زمان | ΔP/P | Vol (cum) | LP/LP_max | MC | N_org |
|------|------|-----------|-----------|-----|-------|
| T+0:00 | 0% | $0 | seed | $0 | 0 |
| T+0:45 | +15% | $3K | 0.40 | $2K | 0 |
| T+1:00 | **+120%** | $15K | 0.60 | $8K | 0 |
| T+2:30 | **+280%** | $45K | 0.80 | $25K | 0 |
| T+4:00 | **+420%** | $75K | **0.92** | $42K | 2 |
| **T+4:59** | **≥+500%** | **≥$100K** | **≥0.95** | **≥$50K** | 5+ |
| T+5:00+ | Phase 2 | organic | hold | rising | **50+** |

> **T+4:59 = deadline.** بعد از ۵ دقیقه attention window بسته می‌شود — سیستم extend نمی‌کند.

### 19.10 Checklist — Blitz: 500% + LP + جذب زیر ۵ دقیقه

> **وضعیت v3.0:** ✅ wired — `StrategyOptimizer` + `market-generator` · verify §25.5

- [x] `strategy.mode`: **BLITZ**
- [x] `targetPriceChangePercent`: **500** (hard floor)
- [x] `maxIgnitionDurationSeconds`: **300**
- [x] `targetTradesPerMinute`: **120** (540 trades in 4.5min)
- [x] `buyBiasPercent`: **65** (80% in first 2 min)
- [x] `minLiquidityRatio`: **0.95**
- [x] `minVolume5mUsd`: **100000**
- [x] `jitoBundleAtLaunch`: **true** (settings flag)
- [x] `preFundWallets`: **true** (settings flag)
- [x] LiquidityAnalyzer poll + sell block
- [x] TokenInfo poll during Blitz
- [x] Ignition hard stop if T>300s (`blitz-strategy.util`)

---

### 19.11 ماژول NestJS جدید — StrategyOptimizer

```
src/modules/strategy-optimizer/
├── strategy-optimizer.module.ts
├── strategy-optimizer.service.ts    # compute J, adjust f_trade, weights
├── phase-detector.service.ts        # Phase 0/1/2/3 state
├── virality-scorer.service.ts       # V(t) from GMGN + internal metrics
└── ignition-controller.service.ts   # closed-loop MC/Vol/ΔP control
```

**Integration:** `CoreTriggerModule` → after MARKET_MAKING starts → `IgnitionController.run(setpoint)` every 1s until Phase 2 detected.

---

## 20. Bot Magnet Strategy — دیده‌شدن در DexScreener / GMGN / CT + جذب همه Bots

> **هدف:** در **< 5 دقیقه** توکن در **همه فیدهای bot** ظاهر شود → snipers + copy-traders + GMGN agents → خرید → LP↑ + سرمایه↑  
> **اصل:** Bots کد می‌خوانند، احساس نمی‌کنند. باید **Signal Bundle** بسازی که همه فیلترها همزمان GREEN شوند.

---

### 20.1 نقشه Platform — هر کدام چه می‌بیند

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    BOT VISIBILITY STACK (< 5 min)                        │
└─────────────────────────────────────────────────────────────────────────┘

 Layer 1 — ON-CHAIN (T+0:30)
   Solana/BSC RPC          → tx count, unique wallets, LP depth
   ↓ indexed by

 Layer 2 — AGGREGATORS (T+1:00 – T+2:30)
   DexScreener             → chart, Vol, MC, LP (needs min tx + vol)
   Birdeye / Solscan       → Solana tx feed
   Etherscan v2            → BSC tx feed
   ↓ scraped by

 Layer 3 — BOT TERMINALS (T+2:00 – T+4:00)
   GMGN.ai                 → trending, trenches, token_signal, security
   Photon / BullX / Trojan → GMGN-like filters + DexScreener link
   Maestro / BonkBot       → launchpad-native snipers
   ↓ triggers

 Layer 4 — BOT BUY CASCADE (T+4:00 – T+5:00+)
   Sniper bots             → auto-buy if ALL filters pass
   Copy-traders            → follow volume spike
   Smart money bots        → GMGN smart_degen signal
   ↓ result

 Layer 5 — ORGANIC CT (T+5:00+)
   Crypto Twitter          → chart screenshot viral → human FOMO
```

---

### 20.2 Signal Bundle — فیلترهای Bot (ALL must be GREEN)

| # | Signal | Threshold | Platform | زمان هدف |
|---|--------|-----------|----------|----------|
| S1 | `tx_count_5m` | ≥ 200 unique tx | DexScreener, GMGN | T+2:00 |
| S2 | `unique_wallets` | ≥ 80 distinct buyers | Bot anti-wash | T+2:00 |
| S3 | `Vol_5m` | ≥ $100,000 | DexScreener trending | T+4:00 |
| S4 | `ΔP/P_5m` | ≥ +500% | Chart vertical | T+4:59 |
| S5 | `MC` | ≥ $50,000 | GMGN rank eligibility | T+4:00 |
| S6 | `LP/LP_max` | ≥ 0.95 | Deep liquidity pass | T+4:00 |
| S7 | `security_score` | ≥ 70 (GMGN) | Sniper safety gate | T+1:00 |
| S8 | `is_honeypot` | `"no"` | Hard filter | T+1:00 |
| S9 | `renounced_mint` + `renounced_freeze` | `true` (SOL) | Sol bot filter | pre-launch config |
| S10 | `buys_5m` / `sells_5m` | ratio ≥ 1.5 (bullish) | Momentum bots | T+3:00 |
| S11 | `holder_count` | ≥ 50 | Distribution signal | T+3:00 |
| S12 | `is_wash_trading` | `false` | GMGN anti-spam | T+4:00 |

**Bot Buy Probability:**

```
P(bot_buy) = Π P(pass Si)  for i = 1..12

Target: P(bot_buy) ≥ 0.90 by T+4:59
```

---

### 20.3 Orchestration — ۴ فاز Visibility (همزمان با Blitz)

```
PHASE α — INDEX (T+0:00 → T+1:00)
─────────────────────────────────
Goal: appear on-chain feeds → DexScreener/Birdeye start indexing

Actions:
  • Jito bundle: launch + 30 wallet BUY same block
  • 40+ unique wallet txs in first 60 sec
  • Min trade size ≥ $5 (visible on aggregators)
  • Token metadata: name/symbol with TREND keyword (searchable)

Check:
  ✓ Solscan/Etherscan: token address has ≥20 tx
  ✓ DexScreener API: pair exists (poll every 15s)


PHASE β — DISCOVER (T+1:00 → T+2:30)
─────────────────────────────────────
Goal: enter GMGN + DexScreener discovery feeds

Actions:
  • f_trade = 150/min — 200 wallets rotating (anti-wash pattern)
  • GMGN GET /v1/token/info → verify listed
  • GMGN GET /v1/token/security → score ≥70 published
  • POST security check BEFORE heavy trading (S7,S8 early)
  • buys_5m / sells_5m ratio → 1.8 (strong buy pressure)

GMGN Trenches trigger (POST /v1/trenches filters):
  • volume_5m rising
  • holder_count ≥ 30
  • smart_wallets starting to appear (from our diverse wallet pattern)

Check:
  ✓ GMGN token/info returns non-empty price + volume
  ✓ DexScreener: chart live with candle data


PHASE γ — TREND (T+2:30 → T+4:00)
─────────────────────────────────
Goal: hit trending algorithms on GMGN + DexScreener

Actions:
  • Vol velocity max — 120 trades/min sustained
  • MC push ≥ $42K (approaching $50K threshold)
  • LP/LP_max → 0.92+ (liquidity bots filter)
  • GET /v1/market/rank — monitor trending position
  • Unique wallet count ≥ 80 (holder distribution looks organic)
  • Avoid: same wallet back-to-back (wash flag)

DexScreener trending factors:
  • Vol spike vs previous 5m window
  • Tx count acceleration
  • Price change % (green candle cluster)

Check:
  ✓ Vol_5m ≥ $60K (on track for $100K)
  ✓ ΔP/P ≥ +280%
  ✓ GMGN rank position improving


PHASE δ — CASCADE (T+4:00 → T+4:59)
───────────────────────────────────
Goal: ALL 12 signals GREEN → bot army buys

Actions:
  • Final sprint: ΔP → +500%, Vol → $100K+, LP → 95%
  • MC cross $50K → GMGN trending list
  • buys_5m/sells_5m ≥ 1.5 maintained
  • holder_count ≥ 50
  • STOP internal sells that drop LP below 0.90
  • Telegram alert: "BOT MAGNET ACTIVE — all signals green"

Bot cascade math:
  N_bots_estimate ≈ 50–200 (GMGN + Photon + Maestro + native snipers)
  E[bot_inflow] = N_bots × avg_buy_size ≈ 50 × $200 = $10,000+ organic
  → LP↑↑ + MC↑↑ + real profit

Check at T+4:59:
  ✓ SignalBundle.allGreen() === true
  ✓ N_org ≥ 5 (first external wallets = cascade started)
```

---

### 20.4 Anti-Wash Pattern — Bots تشخیص ندهند

Bots flag wash trading if:
- Same wallet buys and sells repeatedly
- Tx from linked wallets (funding source same)
- Volume high but holder_count low

**Our counter-measures:**

| مشکل Bot | راه‌حل سیستم |
|----------|-------------|
| Same wallet loop | 200 **distinct** wallets — each trades ≤6× max then cooldown |
| Linked funding | ChangeNOW → each wallet funded from **different** payin route |
| Low holder count | 200 wallets each hold dust → holder_count ≥ 60 visible |
| Uniform trade size | Randomize amount: `base ± 30%` jitter per trade |
| Perfect timing | Random delay 200–800ms between txs (not robotic 500ms) |
| Wash flag GMGN | `is_wash_trading: false` — monitor every 30s |

```typescript
// trade-engine.service.ts
async nextTrade(wallets: Wallet[]): Promise<Trade> {
  const wallet = pickRandomUnused(wallets);           // no repeat within 60s
  const amount = baseAmount * (0.7 + Math.random() * 0.6);  // ±30% jitter
  const delay  = 200 + Math.random() * 600;           // human-like timing
  const side   = buyBiasRoll(settings.buyBiasPercent); // 65–80% buy
  return { wallet, amount, delay, side };
}
```

---

### 20.5 GMGN-Specific — ورود به Trending / Trenches

**APIs to poll during Blitz (NestJS `GmgnVisibilityService`):**

| Interval | Endpoint | Purpose |
|----------|----------|---------|
| 15s | `GET /v1/token/info` | price, vol, holder_count live |
| 15s | `GET /v1/token/security` | score, honeypot, wash flag |
| 30s | `GET /v1/token/pool_info` | LP depth, exchange name |
| 60s | `GET /v1/market/rank` | trending position |
| 60s | `POST /v1/trenches` | new token feed eligibility |
| 60s | `GET /v1/market/token_top_holders` | distribution check |

**GMGN trending eligibility (reverse-engineered from filters):**

```
GMGN_trend_score =
  w1 · log(Vol_5m) +
  w2 · ΔP_5m +
  w3 · holder_count +
  w4 · tx_count_5m +
  w5 · security_score −
  w6 · wash_penalty

Target: GMGN_trend_score > θ_trend  (top 50 on /v1/market/rank)
```

**When trending hit → exponential bot visibility:**
- GMGN UI "Trending" tab → thousands of bot operators see token
- Telegram GMGN alert channels → auto-post
- Photon/BullX mirror GMGN data → secondary bot wave

---

### 20.6 DexScreener-Specific — Chart + Trending

**Indexing timeline (Solana / Pump.fun):**

```
T+0:00  Token created on-chain
T+0:30  First trades indexed by Solana RPC
T+1:00  DexScreener bot scrapes → pair page live
T+2:00  Chart candles appear (needs ≥10 tx)
T+3:00  "Trending" if Vol spike > 3× median
T+4:00  Social preview image + MC visible
```

**DexScreener trending trigger (approximate):**

```
DS_trend = (Vol_5m / Vol_prev_5m) × (ΔP_5m) × log(tx_count)

Target: DS_trend > 50 → appears on dexscreener.com/solana trending
```

**NestJS `DexScreenerMonitorService`:**

```typescript
async pollIndexing(mint: string): Promise<DexStatus> {
  const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
  const pair = res.pairs?.[0];
  return {
    indexed: !!pair,
    vol5m: pair?.volume?.m5,
    priceChange5m: pair?.priceChange?.m5,
    liquidity: pair?.liquidity?.usd,
    trending: pair?.volume?.m5 > 50000 && pair?.priceChange?.m5 > 200,
  };
}
// Poll every 15s from T+0:45 until indexed → then every 30s
```

---

### 20.7 CT (Crypto Twitter) — Secondary Wave

Bots first (T+4–5min), humans follow (T+5min+):

```
CT_virality = f(chart_screenshot, trend_name, MC_milestone)

Triggers for CT sharing (by others, not us):
  • "+500% in 5 minutes" chart screenshot
  • MC "$50K in 5 min" milestone
  • Token name matches current Twitter trend

Our job: make chart screenshot-worthy by T+4:00
  → vertical green candle cluster
  → high Vol bar
  → clean security badge on GMGN
```

---

### 20.8 NestJS — VisibilityOrchestrator Module

```
src/modules/visibility-orchestrator/
├── visibility-orchestrator.module.ts
├── visibility-orchestrator.service.ts   # master coordinator
├── signal-bundle.service.ts             # S1–S12 allGreen() check
├── gmgn-visibility.service.ts           # GMGN polling + trend score
├── dexscreener-monitor.service.ts         # indexing + trending check
├── anti-wash.service.ts                 # wallet rotation + jitter
├── bot-cascade-detector.service.ts        # N_org spike detection
└── phases/
    ├── phase-alpha.service.ts           # INDEX  T+0–1
    ├── phase-beta.service.ts            # DISCOVER T+1–2.5
    ├── phase-gamma.service.ts           # TREND  T+2.5–4
    └── phase-delta.service.ts           # CASCADE T+4–5
```

**Integration with Core Trigger:**

```
MARKET_MAKING start
  → VisibilityOrchestrator.run() parallel with BlitzController
  → every 15s: signalBundle.evaluate()
  → every phase transition: adjust buyBias + f_trade
  → T+4:59: signalBundle.allGreen() ?
      YES → Phase 2 → stop internal → let bots buy
      NO  → Telegram BLITZ_MISS + optional extend 30s ONCE
```

---

### 20.9 Settings — Bot Magnet

```json
{
  "strategy": {
    "mode": "BLITZ",
    "visibility": {
      "enabled": true,
      "minUniqueWallets5m": 80,
      "minTxCount5m": 200,
      "minHolderCount": 50,
      "minBuySellRatio": 1.5,
      "dexScreenerPollSeconds": 15,
      "gmgnPollSeconds": 15,
      "antiWashEnabled": true,
      "tradeAmountJitterPercent": 30,
      "tradeDelayMsMin": 200,
      "tradeDelayMsMax": 800,
      "maxTradesPerWallet": 4,
      "walletCooldownSeconds": 60
    }
  }
}
```

---

### 20.10 Timeline یکپارچه — Blitz + Bot Magnet

| T | Blitz | Visibility | Bot reaction |
|---|-------|-------------|--------------|
| +0:00 | Launch + Jito 30 buy | Phase α INDEX | — |
| +0:45 | 40 tx, 30 wallets | DexScreener poll start | — |
| +1:00 | ΔP +120% | Phase β DISCOVER, security ≥70 | Solscan indexed |
| +1:30 | 100 tx | GMGN token/info live | GMGN bots scanning |
| +2:30 | ΔP +280%, Vol $45K | Phase γ TREND | DexScreener chart live |
| +3:00 | 80 unique wallets | holder_count ≥50 | Distribution pass |
| +4:00 | ΔP +420%, LP 92% | Phase δ CASCADE prep | Trending algorithms firing |
| +4:59 | **+500%, Vol $100K, LP 95%** | **SignalBundle GREEN** | **Bots BUY** |
| +5:00+ | Stop internal | Monitor N_org | LP↑ MC↑ profit |

---

### 20.11 Checklist — Bot Magnet

> **وضعیت v3.0:** ✅ wired — `VisibilityOrchestrator` + `SignalBundleService` · verify §25.5

- [x] 200 unique wallets (holder count signal — configurable `marketWalletCount`)
- [x] Anti-wash: jitter + cooldown + max trades/wallet (Redis wallet-state)
- [x] Security score ≥70 before market (Security gate step 4)
- [x] DexScreenerMonitor polling (`dexscreener-monitor.service`)
- [x] GmgnVisibilityService polling
- [x] SignalBundle.allGreen() at cascade (`signal-bundle.service`)
- [x] buys/sells ratio momentum signal
- [x] LP guard during Blitz (liquidity analyzer)
- [x] Trend name in token metadata (TrendPackage → launch)
- [x] Telegram bot magnet / cascade notifications

---

## 21. Treasury Consolidator — تجمیع SOL + BSC به آدرس مقصد متغیر

> **هدف:** با یک trigger، **همه توکن‌های قابل‌فروش** در **همه ولت‌های سیستم** (Owner + Market + در صورت نیاز Main Fee Wallet) سریع فروخته شوند، native/stable جمع شود، و **یکجا** به **آدرس ولت نهایی** که **هر بار متفاوت** از API/Settings می‌دهید منتقل شود.

### 21.1 خلاصه

| مشخصه | مقدار |
|-------|-------|
| شبکه | `SOLANA` \| `BSC` \| `BOTH` |
| Scope | `cycleId` خاص \| `GLOBAL` (همه چرخه‌ها + orphan wallets) |
| مقصد | `destinationAddress` — **الزامی، هر run متفاوت** |
| خروجی نهایی | `SOL` / `BNB` / `USDC` (قابل تنظیم) |
| SLA | 200 wallet → **< 120s** (sell + sweep + transfer) |
| API | `POST /api/v1/treasury/consolidate` |

**تفاوت با §17 Emergency Brake:**

| | Emergency Brake | Treasury Consolidator |
|--|-----------------|----------------------|
| مقصد | ثابت — Main Fee Wallet | **متغیر — destinationAddress** |
| سناریو | توقف اضطراری | تجمیع سود / خالی کردن سیستم |
| تبدیل | optional USDC | **convertTo** قابل انتخاب |
| Main Fee Wallet | همیشه مقصد | **اختیاری** به‌عنوان source |

---

### 21.2 فلو ۱۱ مرحله‌ای

```
[TRIGGER: POST /treasury/consolidate]
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. VALIDATE                 │ destinationAddress format     │
│                             │ SOL: base58 32–44 chars       │
│                             │ BSC: 0x + 40 hex              │
│                             │ optional: requireConfirm=true │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. LOCK                     │ Redis `consolidate:{jobId}`   │
│                             │ pause MarketGenerator jobs    │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. RESOLVE WALLETS          │ Owner + Market (+ Main Fee?)  │
│                             │ filter: network, scope        │
│                             │ skip empty / dust (< minUsd)    │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. INVENTORY SCAN           │ per wallet:                   │
│                             │ - SPL / BEP-20 tokens         │
│                             │ - native SOL/BNB balance      │
│                             │ - USDC/USDT if any            │
│                             │ GMGN security: skip honeypot   │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. SELL ALL SELLABLE        │ BullMQ: consolidate-sell (×20)│
│                             │ Pump.fun / Raydium (SOL)      │
│                             │ Pancake / FourMeme (BSC)      │
│                             │ slippage: settings (default 15%)│
│                             │ skip: non-liquid / blacklisted│
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. SWEEP NATIVE             │ BullMQ: consolidate-sweep (×10)│
│                             │ collect SOL/BNB per wallet    │
│                             │ leave minGasReserve (rent/gas)  │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. CONVERT (optional)       │ if convertTo = USDC:          │
│                             │ ChangeNOW / Jupiter / Pancake │
│                             │ native → USDC on-chain        │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. STAGE AGGREGATION        │ Redis staging ledger per net  │
│                             │ sum: totalNative, totalUsdc   │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 9. FINAL TRANSFER           │ BullMQ: consolidate-transfer  │
│                             │ SOL → destinationAddress      │
│                             │ BSC → destinationAddress        │
│                             │ batch if > maxTxSize            │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 10. VERIFY ON-CHAIN         │ confirm N blocks              │
│                             │ Etherscan / Solscan receipt   │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ 11. LEDGER + TELEGRAM       │ treasury_consolidate_logs     │
│                             │ resume MarketGenerator        │
└─────────────────────────────────────────────────────────────┘
```

---

### 21.3 API

**POST** `/api/v1/treasury/consolidate`

```json
{
  "scope": "GLOBAL",
  "cycleId": null,
  "networks": ["SOLANA", "BSC"],
  "destinationAddress": {
    "SOLANA": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "BSC": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"
  },
  "convertTo": "NATIVE",
  "includeMainFeeWallet": false,
  "sellAllTokens": true,
  "minSweepUsd": 0.5,
  "slippageBps": 1500,
  "reason": "post-cycle profit consolidation"
}
```

| فیلد | نوع | توضیح |
|------|-----|-------|
| `scope` | `CYCLE` \| `GLOBAL` | GLOBAL = همه ولت‌ها |
| `destinationAddress` | object \| string | per-network یا یک آدرس برای هر دو (EVM/SOL جدا validate) |
| `convertTo` | `NATIVE` \| `USDC` | خروجی نهایی |
| `includeMainFeeWallet` | boolean | آیا موجودی Main Fee هم sweep شود |
| `sellAllTokens` | boolean | default true — همه توکن قابل‌فروش |
| `minSweepUsd` | number | زیر این مقدار skip (dust) |
| `slippageBps` | number | default از Settings |

**Response 202:**

```json
{
  "jobId": "consolidate_8f3a2b1c",
  "status": "QUEUED",
  "networks": ["SOLANA", "BSC"],
  "walletCount": 187,
  "estimatedDurationSeconds": 95,
  "destinations": {
    "SOLANA": "7xKX...",
    "BSC": "0x742d..."
  }
}
```

**GET** `/api/v1/treasury/consolidate/{jobId}`

```json
{
  "jobId": "consolidate_8f3a2b1c",
  "status": "COMPLETED",
  "progress": {
    "walletsTotal": 187,
    "walletsSold": 187,
    "walletsSwept": 185,
    "tokensSold": 412,
    "tokensSkipped": 3
  },
  "totals": {
    "SOLANA": { "native": "12.45 SOL", "usdc": "0", "txHash": "5abc..." },
    "BSC": { "native": "2.1 BNB", "usdc": "0", "txHash": "0xdef..." }
  },
  "destinationConfirmed": true,
  "durationSeconds": 87
}
```

---

### 21.4 NestJS — TreasuryConsolidator Module

```
src/modules/treasury-consolidator/
├── treasury-consolidator.module.ts
├── treasury-consolidator.controller.ts
├── treasury-consolidator.service.ts
├── destination-validator.service.ts     # SOL/BSC address check
├── inventory-scanner.service.ts         # token + native scan
└── processors/
    ├── consolidate-sell.processor.ts    # parallel sell all
    ├── consolidate-sweep.processor.ts   # native collection
    └── consolidate-transfer.processor.ts # final send to destination
```

**Dependencies:**

```
TreasuryConsolidatorService
  → WalletGeneratorService      (list wallets)
  → MarketGeneratorService      (pause/resume)
  → TokenInfoService            (balances)
  → SecurityCheckService        (skip honeypot)
  → ChangeNowService            (optional USDC)
  → MainFeeWalletService        (optional source)
  → TelegramService             (notify)
```

---

### 21.5 BullMQ Queues

| Queue | Concurrency | Timeout | توضیح |
|-------|-------------|---------|-------|
| `consolidate-sell` | 20 | 30s/wallet | فروش 100% توکن |
| `consolidate-sweep` | 10 | 15s/wallet | جمع SOL/BNB |
| `consolidate-transfer` | 5 | 20s/batch | انتقال نهایی |

**Job dedup:** `consolidate:{scope}:{network}` — فقط یک job فعال همزمان per scope+network.

---

### 21.6 Settings — treasury.consolidate

```json
{
  "treasury": {
    "consolidate": {
      "enabled": true,
      "defaultConvertTo": "NATIVE",
      "defaultSlippageBps": 1500,
      "minGasReserveSol": 0.002,
      "minGasReserveBnb": 0.001,
      "minSweepUsd": 0.5,
      "requireDestinationConfirm": false,
      "allowedDestinationAddresses": [],
      "maxConcurrentJobs": 1,
      "includeMainFeeWalletByDefault": false,
      "telegramNotifyOnComplete": true
    }
  }
}
```

| Setting | توضیح |
|---------|-------|
| `allowedDestinationAddresses` | خالی = هر آدرس مجاز؛ پر = whitelist |
| `requireDestinationConfirm` | true → باید `confirmToken` از Telegram/API |
| `minGasReserveSol/Bnb` | برای rent/gas در ولت مبدأ باقی بماند |

---

### 21.7 DB — treasury_consolidate_logs

```sql
CREATE TABLE treasury_consolidate_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          VARCHAR(64) UNIQUE NOT NULL,
  scope           VARCHAR(16) NOT NULL,          -- CYCLE | GLOBAL
  cycle_id        UUID,
  networks        JSONB NOT NULL,                -- ["SOLANA","BSC"]
  destination     JSONB NOT NULL,              -- per-network addresses
  convert_to      VARCHAR(16) NOT NULL,
  wallets_total   INT NOT NULL,
  tokens_sold     INT DEFAULT 0,
  tokens_skipped  INT DEFAULT 0,
  totals          JSONB,                         -- { SOLANA: {...}, BSC: {...} }
  status          VARCHAR(32) NOT NULL,        -- QUEUED|RUNNING|COMPLETED|FAILED
  error_message   TEXT,
  duration_ms     INT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_consolidate_status ON treasury_consolidate_logs(status);
CREATE INDEX idx_consolidate_created ON treasury_consolidate_logs(created_at DESC);
```

---

### 21.8 مثال end-to-end

```
POST /treasury/consolidate
  scope: GLOBAL
  networks: [SOLANA, BSC]
  destinationAddress:
    SOLANA: 9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM
    BSC:    0x8894E0a0c962CB723c1976a4421c95949bE2D4E3

[87 seconds later]

SOLANA: 152 wallets → sold 340 tokens → swept 11.2 SOL → tx 3kF9...
BSC:    35 wallets  → sold 72 tokens  → swept 1.8 BNB  → tx 0x7a2...

Telegram: ✅ Consolidation complete — 11.2 SOL + 1.8 BNB → destinations confirmed
```

---

### 21.9 Checklist — Treasury Consolidator

> **وضعیت v3.0:** ✅ hardened — on-chain verify · Redis lock · §24.7

- [x] `POST /treasury/consolidate` + GET job status
- [x] destinationAddress validation (SOL + EVM)
- [x] Sell all sellable tokens (parallel ×20)
- [x] Sweep native with gas reserve
- [x] Optional USDC conversion
- [x] Final transfer to **dynamic** destination per request
- [x] GLOBAL + CYCLE scope
- [x] SOLANA + BSC + BOTH
- [x] Pause MarketGenerator during run
- [x] treasury_consolidate_logs table
- [x] Telegram notification on complete/fail
- [x] Optional destination whitelist in Settings

---

## 22. Treasury Lifecycle — خالی کردن کامل، شارژ Main Fee، ولت جدید یا بازاستفاده

> **هدف عملیاتی:** هر وقت لازم بود:
> 1. **همه ولت‌ها را کامل خالی کنید** (توکن + native → Main Fee Wallet)
> 2. در صورت نیاز **USDC/ETH** به Main Fee بزنید (از خارج)
> 3. سیستم **ولت جدید بسازد** یا **با ولت‌های قبلی** دوباره fund کند
> 4. چرخه بعدی را شروع کنید — و **هر وقت خواستید** دوباره از مرحله ۱

این §22 **§21 Consolidator** را برای «reset داخلی» و **§17 Brake** را برای «اضطرار» به هم وصل می‌کند.

---

### 22.1 نمای کلی چرخه

```
┌──────────────────────────────────────────────────────────────────┐
│                    TREASURY LIFECYCLE (repeatable)                │
└──────────────────────────────────────────────────────────────────┘

  [ACTIVE CYCLE]  Market making / monitoring
        │
        │  POST /treasury/drain   (یا lifecycle/run)
        ▼
  [DRAINING]  sell all + sweep → Main Fee Wallet (+ optional USDC)
        │
        ▼
  [DRAINED]   همه market/owner wallets خالی — فقط gas reserve باقی
        │
        │  (optional) واریز خارجی USDC/ETH → Main Fee addresses
        │  GET /main-fee-wallet → balance OK?
        ▼
  [REARMING]  POST /treasury/rearm
        │     ├─ walletPool: FRESH  → ولت‌های جدید
        │     ├─ walletPool: REUSE  → ولت‌های drained قبلی
        │     └─ walletPool: AUTO   → طبق marketWalletUsageMode
        │     ChangeNOW: Main Fee USDC/ETH → SOL/BNB per wallet
        ▼
  [READY]     wallets FUNDED — منتظر Core Trigger / Cron
        │
        ▼
  [ACTIVE CYCLE]  ...
        │
        └──► هر وقت خواستید دوباره DRAIN
```

---

### 22.2 State Machine — وضعیت ولت

| Status | معنی | بعد از Drain | بعد از Rearm |
|--------|------|--------------|--------------|
| `ACTIVE` | در چرخه فعال | → `DRAINED` | — |
| `DRAINING` | در حال فروش/sweep | — | — |
| `DRAINED` | خالی، آماده reuse | — | → `IDLE` یا `ARCHIVED` |
| `IDLE` | خالی، قابل reuse (MULTI_USE) | — | → `FUNDING` |
| `ARCHIVED` | retired (SINGLE_USE) | — | — |
| `FUNDING` | ChangeNOW در جریان | — | → `FUNDED` |
| `FUNDED` | آماده trade | — | → `ACTIVE` (cycle start) |

**قوانین:**

| `marketWalletUsageMode` | بعد از Drain | Rearm با `FRESH` | Rearm با `REUSE` |
|-------------------------|--------------|------------------|------------------|
| `SINGLE_USE` | → `ARCHIVED` | N ولت **جدید** | فقط اگر `forceReuse: true` (admin override) |
| `MULTI_USE` | → `IDLE` | N ولت جدید (قدیمی ARCHIVED) | همان ولت‌های `IDLE` fund شوند |

**Token Owner:** همیشه یک‌بارمصرف — بعد از drain → `ARCHIVED`؛ چرخه بعد **همیشه** Owner جدید.

---

### 22.3 فاز A — Drain (خالی کردن کامل)

**POST** `/api/v1/treasury/drain`

معادل `consolidate` با مقصد ثابت **Main Fee Wallet** — برای reset داخلی سریع‌تر.

```json
{
  "scope": "GLOBAL",
  "networks": ["SOLANA", "BSC"],
  "convertTo": "USDC",
  "includeOwnerWallets": true,
  "includeMainFeeWallet": false,
  "reason": "end of cycle — full drain"
}
```

| فیلد | default | توضیح |
|------|---------|-------|
| `convertTo` | `USDC` | همه چیز USDC در Main Fee جمع شود |
| `includeOwnerWallets` | true | Owner هم sell + sweep |
| `scope` | GLOBAL | همه چرخه‌های فعال pause + drain |

**فلو داخلی:**

```
1. pause CoreTrigger + MarketGenerator (همه sessions)
2. ProfitExtractor final run (force) — creator trim + market TWAP check before drain
3. consolidate-sell (all wallets)
4. consolidate-sweep → staging
5. ChangeNOW / Jupiter: native → USDC → Main Fee Wallet addresses
6. mark wallets DRAINED / ARCHIVED / IDLE
7. Telegram: "DRAIN COMPLETE — Main Fee: $X USDC"
```

**Response 202:** `{ "jobId": "drain_...", "status": "QUEUED", "phase": "DRAINING" }`

---

### 22.4 فاز B — Top-up Main Fee (USDC / ETH از خارج)

Main Fee Wallet آدرس‌های ثابت سیستم است (Sol + BSC + ETH برای ChangeNOW).

| شبکه | asset | کاربرد |
|------|-------|--------|
| Ethereum | USDC, ETH | منبع ChangeNOW برای fund کردن BSC/SOL |
| Solana | USDC, SOL | fund مستقیم ولت‌های SOL |
| BSC | USDC, BNB | fund مستقیم ولت‌های BSC |

**کاربر:** USDC/ETH را **خارج از سیستم** به آدرس Main Fee می‌فرستد.

**سیستم:** polling هر ۳۰s روی Main Fee balances (`MainFeeWalletService.watchDeposits()`).

```http
GET /api/v1/main-fee-wallet
```

```json
{
  "balances": {
    "ETH_USDC": "12500.00",
    "ETH_ETH": "0.5",
    "SOL_USDC": "3200.00",
    "SOL_SOL": "45.2",
    "BSC_USDC": "800.00",
    "BSC_BNB": "2.1"
  },
  "totalUsdEstimate": 16500,
  "isReadyForRearm": true,
  "minRearmBalanceUsd": 500
}
```

| Setting | default | توضیح |
|---------|---------|-------|
| `treasury.lifecycle.minRearmBalanceUsd` | **5000** | حداقل موجودی قبل از rearm |
| `treasury.lifecycle.depositPollSeconds` | 30 | فاصله check واریز |

> **نیازی به API واریز جدا نیست** — on-chain detect کافی است. اختیاری: `POST /main-fee-wallet/deposit/notify` برای expedite poll.

---

### 22.5 فاز C — Rearm (ولت جدید یا قبلی + Funding)

**POST** `/api/v1/treasury/rearm`

```json
{
  "networks": ["SOLANA", "BSC"],
  "walletPoolStrategy": "AUTO",
  "marketWalletCount": 200,
  "forceReuse": false,
  "sourceAsset": "USDC",
  "amountPerWalletUsd": 0.10,
  "skipIfBalanceInsufficient": true,
  "startCycleAfterRearm": false
}
```

| `walletPoolStrategy` | رفتار |
|---------------------|-------|
| `FRESH` | archive همه IDLE/DRAINED → `WalletGenerator.batchCreate(200)` |
| `REUSE` | fund همان ولت‌های `IDLE`/`DRAINED` (بدون key جدید) |
| `AUTO` | `SINGLE_USE` → FRESH؛ `MULTI_USE` → REUSE |

**Funding pipeline** (همان §11 ChangeNOW):

```
Main Fee USDC (ETH chain)
  → ChangeNOW ×20 parallel
  → each market wallet receives SOL or BNB
  → status FUNDED
```

| `sourceAsset` | `targetNetwork` | مسیر |
|---------------|-------------------|------|
| USDC | SOLANA | ChangeNOW USDC→SOL |
| USDC | BSC | ChangeNOW USDC→BNB |
| ETH | BSC | ChangeNOW ETH→BNB |

**Response 202:**

```json
{
  "jobId": "rearm_abc123",
  "phase": "REARMING",
  "walletPoolStrategy": "REUSE",
  "walletsCreated": 0,
  "walletsReused": 148,
  "walletsFunding": 148,
  "estimatedDurationSeconds": 180
}
```

---

### 22.6 فاز D — یک‌کلیکی: Lifecycle Run

**POST** `/api/v1/treasury/lifecycle/run`

```json
{
  "drain": {
    "scope": "GLOBAL",
    "convertTo": "USDC"
  },
  "waitForDeposit": {
    "enabled": true,
    "minBalanceUsd": 1000,
    "timeoutMinutes": 60
  },
  "rearm": {
    "walletPoolStrategy": "AUTO",
    "marketWalletCount": 200,
    "sourceAsset": "USDC",
    "amountPerWalletUsd": 0.10
  },
  "startCycleAfterRearm": true
}
```

**فلو:**

```
DRAIN → wait until Main Fee ≥ minBalanceUsd (or timeout)
     → REARM (fresh/reuse per strategy)
     → optional: CoreTrigger.startNextCycle()
     → Telegram summary
```

**GET** `/api/v1/treasury/lifecycle/{jobId}` — فاز فعلی: `DRAINING | WAITING_DEPOSIT | REARMING | READY | FAILED`

---

### 22.7 Settings — treasury.lifecycle

```json
{
  "treasury": {
    "lifecycle": {
      "enabled": true,
      "defaultDrainConvertTo": "USDC",
      "defaultWalletPoolStrategy": "AUTO",
      "minRearmBalanceUsd": 5000,
      "depositPollSeconds": 30,
      "defaultAmountPerWalletUsd": 0.10,
      "defaultSourceAsset": "USDC",
      "allowForceReuseOnSingleUse": false,
      "autoPauseCyclesOnDrain": true,
      "telegramNotifyOnPhaseComplete": true,
      "lifecycleRunTimeoutMinutes": 120
    }
  }
}
```

---

### 22.8 DB — treasury_lifecycle_jobs

```sql
CREATE TABLE treasury_lifecycle_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          VARCHAR(64) UNIQUE NOT NULL,
  phase           VARCHAR(32) NOT NULL,  -- DRAINING|WAITING_DEPOSIT|REARMING|READY|FAILED
  drain_job_id    VARCHAR(64),
  rearm_job_id    VARCHAR(64),
  wallet_strategy VARCHAR(16),
  wallets_created INT DEFAULT 0,
  wallets_reused  INT DEFAULT 0,
  main_fee_usd_before NUMERIC,
  main_fee_usd_after  NUMERIC,
  config          JSONB NOT NULL,
  status          VARCHAR(32) NOT NULL,
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);
```

**Wallet table extension:**

```sql
ALTER TABLE wallets ADD COLUMN lifecycle_status VARCHAR(16) DEFAULT 'ACTIVE';
-- ACTIVE | DRAINING | DRAINED | IDLE | ARCHIVED | FUNDING | FUNDED
```

---

### 22.9 سناریوهای عملی

**سناریو ۱ — پایان چرخه، ولت جدید برای بار بعد**

```
1. POST /treasury/drain          → $585 USDC به Main Fee
2. (شما) +$5000 USDC به Main Fee ETH address
3. POST /treasury/rearm
     walletPoolStrategy: FRESH
     marketWalletCount: 200
4. Cron یا POST /core-trigger/start → چرخه جدید با ۲۰۰ ولت تازه
```

**سناریو ۲ — MULTI_USE، همان ولت‌ها**

```
Settings: marketWalletUsageMode = MULTI_USE
1. POST /treasury/drain
2. Main Fee already has enough USDC
3. POST /treasury/rearm
     walletPoolStrategy: REUSE   → 148 ولت قبلی fund می‌شوند
4. start cycle
```

**سناریو ۳ — فقط خالی کن، بعداً rearm**

```
POST /treasury/drain
... هفته بعد ...
POST /treasury/rearm
```

**سناریو ۴ — یک‌کلیکی**

```
POST /treasury/lifecycle/run
  waitForDeposit.minBalanceUsd: 2000
  rearm.walletPoolStrategy: AUTO
  startCycleAfterRearm: true
```

---

### 22.10 تفاوت Drain vs Consolidate vs Brake

| | Drain §22 | Consolidate §21 | Brake §17 |
|--|-----------|-----------------|-----------|
| مقصد | Main Fee Wallet | آدرس متغیر | Main Fee Wallet |
| convertTo | USDC (default) | NATIVE/USDC | USDC |
| pause cycles | ✅ | ✅ | ✅ |
| wallet state update | ✅ DRAINED/IDLE/ARCHIVED | ❌ | partial |
| rearm بعدش | ✅ designed for | manual | manual |
| use case | **reset عادی** | برداشت به ولت خارجی | **اضطرار** |

---

### 22.11 Checklist — Treasury Lifecycle

- [x] `POST /treasury/drain` — full empty → Main Fee USDC
- [x] Wallet lifecycle_status column + state transitions
- [x] `POST /treasury/rearm` — FRESH | REUSE | AUTO
- [x] Respect SINGLE_USE vs MULTI_USE
- [x] Main Fee deposit polling
- [x] `POST /treasury/lifecycle/run` — orchestrated flow
- [x] Pause/resume CoreTrigger around drain
- [x] ChangeNOW funding from USDC/ETH (existing pipeline)
- [x] Token Owner always fresh on new cycle (via Core Trigger wallet generation)
- [x] Telegram phase notifications

---

## 23. Operational Summary — خلاصه عملیاتی (یک‌صفحه‌ای)

> **مخاطب:** اپراتور، سرمایه‌گذار، تیم فنی — مرجع سریع «سیستم در production چه کار می‌کند؟»  
> **جزئیات فنی:** §4 (چرخه)، §17–§22 (اضطرار/تجمیع/reset)، §19–§20 (Blitz + Bot Magnet)

---

### 23.1 حلقه اصلی سیستم

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         OPERATIONAL LOOP (repeatable)                    │
└─────────────────────────────────────────────────────────────────────────┘

  Cron (هر N ساعت)  ──►  چرخه جدید  ──►  لانچ + Blitz  ──►  جذب خارجی
        ▲                                                      │
        │                                                      ▼
        └────────  COMPLETED + گزارش TG  ◄──  Monitoring  ◄──  Phase 2
```

| پارامتر | پیش‌فرض | Settings |
|---------|---------|----------|
| فاصله بین چرخه‌ها | **هر ۴ ساعت** | `cronExpression: "0 */4 * * *"` |
| شبکه | Solana + BSC | `networkPriority` |
| بودجه هر چرخه | تا $500 | `maxInvestmentUsd` |
| تعداد ولت Market | 200 | `marketWalletCount` |
| حالت ولت | یک‌بارمصرف | `marketWalletUsageMode: SINGLE_USE` |

**شروع چرخه:** خودکار (Cron) یا دستی `POST /core-trigger/cycles`

---

### 23.2 یک چرخه — ۱۰ مرحله

| # | مرحله | State | چه می‌شود | زمان | Gate / Fail |
|---|-------|-------|-----------|------|-------------|
| 1 | Trend | `TREND_GENERATION` | AI: نام، symbol، لوگو، description | ~1–2 min | retry · Redis lock |
| 2 | Launchpad | `LAUNCHPAD_SELECTION` | GMGN score → بهترین pad | ثانیه | settings min liquidity |
| 3 | Wallets | `WALLET_GENERATION` | 1× Owner + N× Market | ~1 min | KMS encrypt keys |
| 4 | Security | `SECURITY_CHECK` | GMGN benchmark ≥ minScore | ثانیه | **FAILED** if risky |
| 5 | Funding | `FUNDING` | ChangeNOW → poll COMPLETED | ~2–5 min | **FAILED** timeout/fail |
| 6 | Launch | `TOKEN_LAUNCH` | on-chain + verify tx | **T+0** | launch lock · pending recovery |
| 7 | Blitz | `MARKET_MAKING` | HFT · StrategyOptimizer · Visibility | **~5 min** | 300s hard stop |
| 8 | Phase 2 | `MARKET_MAKING` | organic inflow · lower HFT | post-T+5 | budget guard |
| 9 | Monitor | `MONITORING` | metrics + Profit Extractor (OWNER_TRIM / MARKET_TWAP) | تا session end | market gate WAIT ok |
| 10 | Done | `COMPLETED` | Telegram PnL + final extract | — | — |

> **ترتیب حیاتی:** Security (۴) **قبل از** Funding (۵) — توکن risky هرگز funded نمی‌شود.  
> **State machine:** §9.5 · **Hardening:** §24

---

### 23.3 Blitz — ۵ دقیقه حیاتی

```
T+0:00   لانچ + Jito bundle (Solana) + 30 wallet buy
T+0:45   200 wallet funded (ChangeNOW parallel)
T+1:00   ΔP ~+120%  |  Vol rising  |  DexScreener/GMGN indexing
T+4:59   HARD CHECK: ΔP ≥+500% AND Vol ≥$100K AND LP ≥95% AND MC ≥$50K
T+5:00   ✅ → Phase 2 (organic)     ❌ → BLITZ_MISS alert (no extend >5min)
T>300s   BlitzController hard stop — ignition تمام
```

| هدف Blitz | مقدار | Settings key |
|-----------|-------|--------------|
| رشد قیمت | ≥ +500% | `targetPriceChangePercent` |
| Volume 5m | ≥ $100K | `minVolume5mUsd` |
| LP ratio | ≥ 95% | `minLiquidityRatio` |
| Market cap | ≥ $50K | `minMarketCapUsd` |
| Trade rate | ~120/min | `targetTradesPerMinute` |
| Max ignition | 300 sec | `maxIgnitionDurationSeconds` |

**جزئیات ریاضی:** §19 | **Visibility / Bot Magnet:** §20

---

### 23.4 بازارسازی کی stop می‌شود؟

| حالت | trigger | API | مسیر |
|------|---------|-----|------|
| **عادی — Blitz تمام** | T+5 / J_blitz ≥ 1 | — | ✅ خودکار |
| **عادی — Phase 2** | trade داخلی کم → organic | — | ✅ خودکار |
| **عادی — Session done** | monitoring کامل → COMPLETED | — | ✅ خودکار |
| **دستی — stop session** | اپراتور | `POST .../sessions/{id}/stop` | اختیاری |
| **دستی — abort cycle** | اپراتور | `POST .../cycles/{id}/abort` | اختیاری |
| **اضطرار — ترمز §17** | فروش 100% همه ولت‌ها | `POST /emergency/brake` | **فقط اضطرار** |
| **Security fail** | score < 70 | — | خودکار `FAILED` |
| **Budget exceeded** | C_op > maxInvestment | — | خودکار stop |

> **نکته:** در مسیر عادی **ترمز دستی لازم نیست**. Manual Brake در سیستم مشاهده‌شده استفاده نشده — ولی آماده است.

---

### 23.5 سود و holdings (v3)

```
During MONITORING:
  IF ownerHeldPercent > 10%  → OWNER_TRIM (creator only)
  IF market green AND marketHeldPercent > 20% floor → MARKET_TWAP

At COMPLETED:
  → final profit check + Telegram PnL summary
```

| قانون | مقدار |
|-------|-------|
| Creator visible cap | **≤ 10%** supply (`capAppliesTo: TOKEN_OWNER`) |
| Market position floor | **≥ 20%** — TWAP stops below (`minMarketHoldPercent`) |
| Market TWAP | فقط در سبز · `sellInRed: false` |
| مقصد سود | Main Fee Wallet (SOL/BNB/USDC) |

**جزئیات:** §18 · `GET /profit-extractor/status/{cycleId}`

---

### 23.6 Treasury — بین چرخه‌ها (اختیاری)

این بخش **هر ۴ ساعت اجرا نمی‌شود** — فقط وقتی اپراتور بخواهد سیستم را reset کند:

```
DRAIN (خالی کامل)  →  Top-up USDC/ETH به Main Fee  →  REARM (ولت جدید یا reuse)  →  چرخه بعد
```

| عمل | API | use case |
|-----|-----|----------|
| خالی → Main Fee | `POST /treasury/drain` | reset داخلی |
| ولت جدید / reuse + fund | `POST /treasury/rearm` | آماده چرخه بعد |
| یک‌کلیکی | `POST /treasury/lifecycle/run` | drain + wait + rearm |
| برداشت به ولت خارجی | `POST /treasury/consolidate` | آدرس متغیر هر بار |

**جزئیات:** §21–§22

---

### 23.7 Timeline بصری — یک چرخه معمول

```
زمان ──────────────────────────────────────────────────────────────────►

[آماده‌سازی ~5min]  [Blitz ~5min]     [Phase 2 + Monitor]    [Wait Cron]
 Trend→Fund→Launch    HFT 120/min       organic inflow          +4h default
                      +500% target      Profit Extract (TWAP)     next cycle
                      Bot Magnet        Telegram COMPLETED
```

```mermaid
flowchart LR
  subgraph prep [آماده‌سازی ~5min]
    A[Trend AI] --> B[Launchpad]
    B --> C[Wallets + Security]
    C --> D[ChangeNOW Fund]
    D --> E[Token Launch]
  end

  subgraph blitz [Blitz ~5min]
    E --> F[HFT 120/min]
    F --> G{J_blitz ≥ 1?}
  end

  subgraph phase2 [Phase 2 + Monitor]
    G -->|Yes| H[Organic inflow]
    G -->|No| I[BLITZ_MISS alert]
    H --> J[Profit Extract TWAP]
    I --> J
    J --> K[COMPLETED + Telegram]
  end

  subgraph repeat [تکرار]
    K --> L[Cron wait]
    L --> A
  end
```

---

### 23.8 API سریع — اپراتور

| عمل | Method | Endpoint |
|-----|--------|----------|
| شروع چرخه دستی | POST | `/core-trigger/cycles` |
| وضعیت چرخه | GET | `/core-trigger/cycles/{id}` |
| لغو چرخه | POST | `/core-trigger/cycles/{id}/abort` |
| stop بازارسازی | POST | `/market-generator/sessions/{id}/stop` |
| استخراج سود | POST | `/profit-extractor/run` |
| وضعیت holdings | GET | `/profit-extractor/status/{cycleId}` |
| ترمز اضطراری | POST | `/emergency/brake` |
| وضعیت job ترمز | GET | `/emergency/brake/{jobId}` |
| system halt | GET | `/emergency/halt` |
| resume | POST | `/emergency/resume` |
| خالی کردن سیستم | POST | `/treasury/drain` |
| آماده‌سازی مجدد | POST | `/treasury/rearm` |
| lifecycle یک‌کلیک | POST | `/treasury/lifecycle/run` |
| تجمیع به آدرس خارجی | POST | `/treasury/consolidate` |
| Security check | GET/POST | `/security/check` |
| تنظیمات | GET/PATCH | `/settings` |
| Main Fee balance | GET | `/main-fee-wallet` |
| Fund wallets | POST | `/main-fee-wallet/fund` |
| Health (public) | GET | `/health` |
| Integrations health | GET | `/integrations/health` |
| RPC health | GET | `/integrations/rpc/health` |

**Auth:** `X-API-Key` header — جزئیات: §12 · **Swagger:** `GET /docs`

---

### 23.9 FAQ — سوالات متداول

| سوال | جواب |
|------|------|
| هر چند ساعت توکن لانچ می‌شود؟ | Cron — پیش‌فرض **هر ۴ ساعت** |
| بازارسازی شدید چقدر طول می‌کشد؟ | **~۵ دقیقه** Blitz، بعد Phase 2 |
| آیا خودکار stop می‌شود؟ | **بله** — T+5 / 300s hard limit |
| ترمز دستی هر چرخه لازم است؟ | **خیر** — فقط اضطرار |
| سود کجا جمع می‌شود؟ | Main Fee Wallet (via Profit Extractor) |
| چند توکن همزمان؟ | یک چرخه فعال per network priority — GLOBAL brake/drain همه را pause می‌کند |
| ولت‌ها هر بار جدید؟ | `SINGLE_USE` → بله / `MULTI_USE` → reuse ممکن (§22) |
| کلید API کجاست؟ | Settings DB — نه `.env` (§3.7) |

---

### 23.10 Checklist — Operational Readiness (Go-Live)

> **این checkboxها = کار تو (اپراتور)، نه gap کد.** کد ۱۲/۱۲ ✅ است.  
> ترتیب: **بالا → پایین** · هر بخش تمام شود بعد برو بعدی.  
> پرامپت Agent: [`cursor-stage-prompts.md`](./cursor-stage-prompts.md) فاز A–D · جزئیات: [`implementation-roadmap.md`](./implementation-roadmap.md)

---

#### فاز ۱ — زیرساخت

| # | کار | دستور / verify |
|---|-----|----------------|
| 1.1 | Postgres + Redis | `docker compose up -d postgres redis` → `docker compose ps` همه healthy |
| 1.2 | Schema | `npx prisma migrate deploy` → exit 0 |
| 1.3 | Build + test | `npm run build && npm test` → **119 passed** |
| 1.4 | API process | `npm run start:prod` (یا `start:dev`) → `curl -s localhost:5420/api/v1/health \| jq .status` |
| 1.5 | **Worker** (اجباری) | `npm run start:worker` در terminal جدا — بدون worker funding/trade اجرا نمی‌شود |

```bash
# terminal 1
npm run start:prod
# terminal 2
npm run start:worker
```

- [ ] 1.1–1.5 انجام شد

---

#### فاز ۲ — Keys & Settings

| # | کار | verify |
|---|-----|--------|
| 2.1 | `.env` زیرساخت | `DATABASE_URL` · `REDIS_URL` · `KMS_KEY` · `API_KEY` |
| 2.2 | PATCH integrations | OpenAI · GMGN · ChangeNOW · QuickNode **×3** (SOL/BSC/ETH) · `mainFeeWalletEvmPrivateKey` |
| 2.3 | validate | `npm run validate:integrations` → exit 0 |
| 2.4 | health | `curl -s localhost:5420/api/v1/integrations/health -H "X-API-Key: $API_KEY" \| jq '.providers \| to_entries \| map(select(.value.status=="down"))'` → `[]` |
| 2.5 | RPC | `GET /integrations/rpc/health` → solana · bsc · ethereum = up |
| 2.6 | Main fee address | `GET /main-fee-wallet` → `bscAddress` = آدرس مشتق‌شده از private key |
| 2.7 | Telegram | `POST /telegram/test` → پیام در chat |
| 2.8 | Production settings | PATCH: `marketWalletCount: 200` · `maxInvestmentUsd: 5000` · `sellInRed: false` · `minRearmBalanceUsd: 5000` · `cronExpression: "0 */4 * * *"` |

```bash
export API_KEY="your-admin-key"
curl -s -X PATCH localhost:5420/api/v1/settings \
  -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  -d @my-production-settings.json
```

- [ ] 2.1–2.8 انجام شد

---

#### فاز ۳ — سرمایه (قبل از اولین cycle)

| دارایی | شبکه | مقدار @ $5K | چرا |
|--------|------|-------------|-----|
| USDC | Ethereum | ~$3,250 | ChangeNOW payin |
| ETH | Ethereum | ~**$150–200** | **۲۰۱ USDC deposit gas** — بدون این funding fail |
| USDC | Solana | ~$500 | اختیاری |

```bash
curl -s localhost:5420/api/v1/main-fee-wallet -H "X-API-Key: $API_KEY" | jq '.totalUsd, .balanceUsdc, .balanceEth'
```

- [ ] Main Fee `totalUsd ≥ 5000`
- [ ] ETH@Ethereum کافی برای gas (حداقل ~0.05–0.1 ETH بسته به gwei)
- [ ] ChangeNOW API key فعال · partner account شارژ

---

#### فاز ۴ — تست live (۵ wallet — اجباری قبل از 200w)

**Settings تست موقت:**

```json
{ "marketWalletCount": 5, "maxInvestmentUsd": 500, "minTradeAmountUsd": 2, "networkPriority": ["SOLANA"] }
```

| # | تست | دستور | pass اگر |
|---|-----|--------|----------|
| 4.1 | Health | §25.2 endpoints | همه up/degraded OK · down = block |
| 4.2 | Cycle | `POST /core-trigger/cycles` · `dryRun: false` | state → `COMPLETED` |
| 4.3 | Funding | DB `FundingTransaction` | 6 ردیف (1 owner + 5 market) · همه `COMPLETED` |
| 4.4 | Launch | DB `Token` | `txHash` واقعی · Solscan/pump.fun visible |
| 4.5 | Security gate | `securityMinScore: 99` موقت → cycle | `FAILED` **قبل از** لانچ |
| 4.6 | Profit status | `GET /profit-extractor/status/{cycleId}` | `capAppliesTo: "TOKEN_OWNER"` · `ownerHeldPercent` · `marketHeldPercent` |
| 4.7 | Trades | DB `Trade` | `txHash` ≠ null |
| 4.8 | TG | — | `CYCLE_COMPLETE` یا `CYCLE_FAILED` دریافت شد |

```bash
curl -s -X POST localhost:5420/api/v1/core-trigger/cycles \
  -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  -d '{"dryRun": false}'

curl -s localhost:5420/api/v1/cycles/{id} -H "X-API-Key: $API_KEY" | jq '.status, .state'
curl -s localhost:5420/api/v1/profit-extractor/status/{cycleId} -H "X-API-Key: $API_KEY" | jq
```

- [ ] 4.1–4.8 pass (فاز B)

**اختیاری (staging):**

- [ ] `POST /emergency/brake` GLOBAL → `GET /emergency/halt` = halted → `POST /emergency/resume`
- [ ] `POST /treasury/lifecycle/run` mode DRAIN

---

#### فاز ۵ — Production scale (200 wallet)

بعد از فاز ۴ موفق:

- [ ] PATCH: `marketWalletCount: 200` · `maxInvestmentUsd: 5000` · `targetTradesPerMinute: 150`
- [ ] یک cycle full `COMPLETED`
- [ ] Signal Bundle `greenCount` ≥ 10 (هدف 12/12) در CycleLog
- [ ] drain برنامه‌ریزی: هر ۵–۱۰ چرخه `POST /treasury/lifecycle/run`

---

#### فاز ۶ — Monitoring مداوم

| signal | چک | action اگر fail |
|--------|-----|----------------|
| CycleLog | هر cycle ردیف per step | `failedStep` در log |
| Telegram | هر COMPLETED/FAILED | worker down · botToken |
| Funding | `FundingTransaction.failureReason` | ETH کم · ChangeNOW min |
| Queue | BullMQ depth | worker scale · stuck job |
| Halt | `GET /emergency/halt` | resume فقط بعد از review |
| Redis/Postgres | disk · memory | TTL · retention |

- [ ] ۲۴h worker بدون crash · queue lag stable

---

#### Definition of Done (§25.10) — وقتی «go-live شده»

| # | معیار | ✓ |
|---|--------|---|
| D1 | فاز ۱–۳ تیک خورده | [ ] |
| D2 | فاز ۴: cycle واقعی `COMPLETED` | [ ] |
| D3 | `profit-extractor/status` — creator ≤10% یا OWNER_TRIM · market floor OK | [ ] |
| D4 | Telegram `CYCLE_COMPLETE` دریافت شد | [ ] |
| D5 | فاز ۵: 200w cycle (production) | [ ] |
| D6 | ۲۴h worker پایدار | [ ] |

> **تا D1–D4 نشود = هنوز go-live نشده** — حتی اگر کد ۱۰۰٪ آماده باشد.

---

### 23.11 Capital & Costs — سرمایه و هزینه

> **راهنمای کامل:** [`docs/cost-model.md`](./cost-model.md) v3.0

| هدف | Main Fee | `maxInvestmentUsd` |
|-----|----------|-------------------|
| تست (۵–۱۰۰ wallet) | **$800 – $1,000** | $500 – $1,000 |
| **Blitz کامل ۲۰۰ ولت + bot magnet** | **$5,000** | **$5,000** |
| production راحت (buffer) | **$10,000** | $5,000 |

**C_op burn per cycle (Solana):** ~**$280–380** typical — ChangeNOW fee + **ETH deposit gas** + Blitz. USDC principal (~$455) می‌چرخد.

سود تضمین نیست.

---

## 24. Production Hardening — ماتریس قابلیت اطمینان

> **هدف:** صفر silent failure · صفر simulate-money · crash-safe · idempotent

### 24.1 الگوهای مشترک (همه ماژول‌ها)

| الگو | توضیح | ماژول‌های استفاده‌کننده |
|------|-------|-------------------------|
| **Typed errors** | `*.errors.ts` — NestJS filter/map به HTTP/step | همه |
| **On-chain verify** | TX باید confirmed/successful قبل از DB persist | token-factory · market · profit · emergency · treasury |
| **Redis lock** | یک job critical per resource | launch · trend · profit · emergency · treasury |
| **Redis pending** | crash mid-operation → resume بدون duplicate | token launch · market trade |
| **Retry + backoff** | external API / RPC transient failures | GMGN · OpenAI · ChangeNOW · sell |
| **Idempotent persist** | unique constraint / skip if exists | ledger · trades · funding |
| **Settings-driven** | zero hardcode business params | strategy · thresholds · cron · runtime timeouts |
| **CycleLog audit** | هر step success/fail در DB | core-trigger processors |

### 24.2 On-chain verification matrix

| عملیات | Solana check | BSC check | قبل از |
|--------|--------------|-----------|--------|
| Token launch | `hasConfirmedTransaction` | `hasSuccessfulTransaction` | Token DB update |
| Market trade | همان | همان | Trade row insert |
| Profit sell | همان | همان | ledger IN + extraction log |
| Emergency sell | همان | همان | emergency_brake_logs |
| Treasury sell/sweep | همان | همان | consolidate log |

### 24.3 State machine — failure semantics

```
هر step در CoreTrigger:
  try { processor }
  catch (CoreTriggerStepError) → transition FAILED + CycleLog + Telegram(failedStep)
  catch (other)               → wrap → FAILED

FAILED = terminal (retry manual با cycle جدید)
ABORTED = اپراتور POST /abort
```

**ترتیب غیرقابل تغییر:** Trend → Launchpad → Wallets → **Security** → **Funding** → Launch → Market → Monitor → Complete

### 24.4 Funding gate (ریشه ۹۰٪ باگ‌های «صفر سود»)

```
runFundingStep:
  1. queueFundingJobs → BullMQ wallet-funding
  2. waitForFundingRegistration (race fix — worker باید FundingTransaction بسازد)
  3. FundingGateService.pollUntilSettled
       ├── all COMPLETED → OK
       ├── any FAILED    → CoreTriggerStepError FUNDING
       └── timeout       → FAILED + reason
  4. فقط بعد OK → TOKEN_LAUNCH
```

### 24.5 Market making — tick reliability

| مکانیزم | رفتار |
|---------|-------|
| `market:tick:lock` | یک tick همزمان per session |
| `market:tick:failures` | exponential backoff requeue |
| `market:trade:pending` | crash بعد از on-chain · قبل از DB → replay safe |
| `assertWalletFunded(forceRefresh)` | stale balance 0 بعد از funding → prevent |
| Session stop | `POST .../stop` · ignition hard limit 300s |

### 24.6 Profit extraction — zero-gap rules

1. **هرگز** simulate sell — فقط launchpad SDK + verified tx
2. **Creator** بالای 10% → OWNER_TRIM · **Market TWAP** فقط سبز و بالای floor 20%
3. **هرگز** `sellInRed: true` — فروش در ضرر
4. Market gate: در red/low liquidity **WAIT** (مگر `force=true`)
5. Pending token (`address` starts with `pending:`) → status UNAVAILABLE

### 24.7 Emergency & treasury

| سناریو | رفتار |
|--------|-------|
| Global brake | pause 4 queues · Redis `system:operational:halt` · parallel sell/sweep |
| Halt check | `GET /emergency/halt` — block new cycles while halted |
| Resume | `POST /emergency/resume` — manual only after review |
| Brake lock | `emergency:brake:lock` — duplicate brake reject |
| Consolidate | sell → sweep → transfer · verify each leg |
| Lifecycle | drain job → wait external top-up → rearm job · per-job lock |

### 24.8 Observability (حداقل production)

| Signal | منبع | action |
|--------|------|--------|
| Cycle FAILED | CycleLog + TG | بررسی `failedStep` |
| Funding stuck PROCESSING | FundingTransaction | stale → FAILED · re-fund |
| Queue lag | Redis/BullMQ | scale worker replicas |
| Integration degraded | `/integrations/health` | fix RPC/key قبل از cycle |
| BLITZ_MISS | TG alert | بررسی settings · wallet count · RPC speed |

---

## 25. Runbook — از صفر تا اتوماسیون کامل

> **مخاطب:** اپراتور · DevOps · on-call  
> **زمان تخمینی bootstrap:** ۳۰–۶۰ دقیقه (بدون live money test)

### 25.1 Prerequisites

| مورد | حداقل |
|------|-------|
| Node.js | 20 LTS |
| Docker | postgres 16 + redis 7 |
| Keys | OpenAI · GMGN · ChangeNOW · RPC premium · Etherscan v2 |
| Capital | $800 test · $5K Blitz · $10K stable (§23.11) |
| KMS_KEY | 64 hex chars — **backup امن** (wallet encryption) |

### 25.2 Health verification (باید همه pass)

```bash
export API=http://localhost:5420/api/v1
export KEY=your-admin-api-key

curl -s $API/health | jq '.status'                    # ok | degraded
curl -s $API/integrations/health | jq                 # no all-down
curl -s $API/integrations/rpc/health | jq             # solana + bsc + ethereum
npm run validate:integrations                         # exit 0
```

### 25.3 Settings patch (یک‌بار)

```bash
# کپی docs/settings.defaults.json → production-settings.json
# جایگزین همه demo keys · RPC premium · telegram · mainFeeWalletEvmPrivateKey

curl -s $API/settings -H "X-API-Key: $KEY" | jq '.cronExpression, .securityMinScore'

curl -X PATCH $API/settings \
  -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d @production-settings.json
```

**بعد از PATCH:** integrations cache auto-invalidate · scheduler cron refresh

### 25.4 Process supervision

```bash
# Terminal 1 — API + Cron
npm run start:prod

# Terminal 2 — Workers (حیاتی)
npm run start:worker

# یا production:
docker compose up -d app worker   # worker replicas: 2
```

**علامت worker مرده:** funding queued ولی `FundingTransaction` PENDING برای ever · market session active ولی trade count 0

### 25.5 Smoke test — چرخه کامل (staging)

```bash
# 1. Main fee visible
curl -s $API/main-fee-wallet -H "X-API-Key: $KEY" | jq '.totalUsd'

# 2. Start cycle (کم wallet برای تست سرعت)
curl -X POST $API/core-trigger/cycles \
  -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"dryRun": false, "marketWalletCount": 5}'

# 3. Poll cycle (هر 10s)
CYCLE_ID=...
watch -n 10 "curl -s $API/core-trigger/cycles/$CYCLE_ID -H 'X-API-Key: $KEY' | jq '.status'"

# 4. Verify DB
# FundingTransaction: COMPLETED
# Token: address != pending:* · launchTxHash set
# Trade: txHash set (during MARKET_MAKING)
# SecurityReport: score >= min

# 5. Profit status (during MONITORING)
curl -s $API/profit-extractor/status/$CYCLE_ID -H "X-API-Key: $KEY" | jq
```

### 25.6 Recovery playbooks

| symptom | diagnosis | fix |
|---------|-----------|-----|
| Cycle stuck FUNDING | worker down · ChangeNOW fail | `start:worker` · check `FundingTransaction.failureReason` |
| Cycle FAILED SECURITY | benchmark risky | expected · lower test threshold or wait trending |
| Cycle FAILED TOKEN_LAUNCH | owner not funded · RPC | check `assertWalletFunded` · launch pending Redis key |
| Market 0 trades | worker · RPC · balance | worker logs · `GET /wallets/{id}` balance |
| Profit not selling | market gate WAIT | check price/liquidity · or `force: true` manual |
| Double launch fear | — | Redis `token:launch:lock` — safe by design |
| Emergency needed | crash · exploit rumor | `POST /emergency/brake` · verify TG report |
| Full reset | end of day | `POST /treasury/lifecycle/run` |

### 25.7 Automation modes

| Mode | Config | رفتار |
|------|--------|-------|
| **Full auto** | cronExpression set · dryRun=false | چرخه هر N ساعت · zero touch |
| **Manual trigger** | cron disabled | فقط `POST /core-trigger/cycles` |
| **Dry run** | dryRun=true | AI + state machine بدون on-chain money |
| **Profit off** | `strategy.profitExtract.enabled=false` | monitor only |

### 25.8 Security operations

- API key فقط در header — rotate از deploy secret
- Private keys: encrypted at rest (KMS_KEY) — **never** commit · **never** PATCH settings log
- `stripMaskedIntegrationPatch` — `***` در PATCH overwrite نمی‌کند
- Security gate: non-negotiable — disable نکن مگر staging

### 25.9 Performance tuning

| bottleneck | knob |
|--------------|------|
| Slow funding | worker replicas · ChangeNOW parallel · reduce wallet count test |
| Slow Blitz | RPC premium · `targetTradesPerMinute` · worker concurrency |
| RPC rate limit | multiple RPC URLs · proxy layer |
| Redis memory | TTLs در §9.7 — don't disable |

### 25.10 Definition of Done — production

سیستم **go-live شده** (نه فقط کد آماده) وقتی:

| # | معیار | مرجع |
|---|--------|------|
| 1 | §23.10 فاز ۱–۳ + فاز ۴ (D1–D4) تیک خورده | checklist بالا |
| 2 | Smoke: cycle واقعی `COMPLETED` با txHash | فاز ۴.2 |
| 3 | `GET /profit-extractor/status/{cycleId}` — `capAppliesTo: TOKEN_OWNER` · owner ≤10% یا trim | فاز ۴.6 |
| 4 | Telegram `CYCLE_COMPLETE` | فاز ۴.8 |
| 5 | فاز ۵: scale 200w · یک cycle production | optional تا D5 |
| 6 | ۲۴h worker بدون crash · queue lag stable | فاز ۶ |
| 7 | `npm test` (119) + `npm run build` سبز | فاز ۱.3 |

```
کد آماده ✅  ≠  go-live شده
go-live شده  =  D1–D4 + D6
production کامل =  + D5 (200w Blitz)
```

---

## 26. Manual Launchpad (CUSTOM_RAYDIUM) — لانچ‌پد کاستوم اختصاصی

### 26.1 هدف و مدل

لانچ‌پد پنجم سیستم، **مستقل از APIهای خارجی** (بدون Pump.fun/letsbonk) — ما خودمان:

1. یک **SPL Token** استاندارد mint می‌کنیم (metadata شبیه دقیق pump.fun؛ ساپلای/دیکیمالز از تنظیمات).
2. یک **Raydium CPMM pool** برای همان توکن + SOL می‌سازیم (Raydium SDK v2 — مستقیم on-chain، نه از طریق API واسط).
3. LP tokenها را در یک **ولت لیکوئیدیتی اختصاصی (custodial)** نگه می‌داریم — مدل انتخابی «**لاک کاستودی**»: هیچ on-chain time-lock قراردادی نیست؛ کنترل کامل روی پلتفرم است تا **آنلاک فوری** در ترمز اضطراری همیشه ممکن باشد (به‌جای لاک زمانی رادیوم/برنر که غیرقابل‌برگشت یا کند است).

**چرا نه امتیازدهی خودکار `launchpad-selector.service.ts`؟** برخلاف Pump.fun/letsbonk، این لانچ‌پد وارد آن امتیازدهی (GMGN + liquidity-analyzer) نمی‌شود، چون پول تازه ساخته‌شده تا چند دقیقه اول ممکن است ایندکس نشده باشد. به‌جایش، انتخاب لانچ‌پد از یک مسیر مستقل و ساده‌تر عبور می‌کند: **`strategy.defaultLaunchpad`** — که پیش‌فرضش (out of the box) دقیقاً `"CUSTOM_RAYDIUM"` است. یعنی سیکل‌هایی که بدون `forceLaunchpad` استارت می‌شوند (شامل سیکل‌های cron/زمان‌بندی‌شده) به‌طور خودکار روی همین لانچ‌پد لانچ می‌شوند — بدون نیاز به override دستی روی هر سیکل. اپراتور می‌تواند:
- `forceLaunchpad: "CUSTOM_RAYDIUM"` (یا هر لانچ‌پد دیگر) روی یک سیکل خاص بفرستد — همیشه اولویت با این است.
- `strategy.defaultLaunchpad` را در تنظیمات به `"AUTO"` تغییر دهد تا رفتار امتیازدهی خودکار قدیمی (فقط بین Pump.fun/letsbonk) برای همه سیکل‌های بعدی برگردد.
- `strategy.defaultLaunchpad` را به یک لانچ‌پد دیگر (`PUMP_FUN`/`LETS_BONK`/`FOUR_MEME`) تغییر دهد تا آن به‌جای CUSTOM_RAYDIUM پیش‌فرض شود.

منطق resolve در `resolveCycleLaunchpad` (`token-launch.util.ts`) پیاده شده و از `CoreTriggerService.startCycle` صدا زده می‌شود: اگر پیش‌فرض تنظیم‌شده با شبکه‌ی سیکل ناسازگار باشد (مثلاً `CUSTOM_RAYDIUM` روی یک سیکل BSC)، بی‌صدا به همان امتیازدهی خودکار (`LaunchpadSelectionProcessor`) سوییچ می‌کند، نه خطا.

### 26.2 فلوی ۷ مرحله‌ای (دقیقاً طبق درخواست عملیات)

```
۱. انتخاب لانچ‌پد کاستوم       → پیش‌فرض سیستم (strategy.defaultLaunchpad="CUSTOM_RAYDIUM") — بدون نیاز به فیلد اضافه؛ یا صریح: POST /core-trigger/cycles { forceLaunchpad: "CUSTOM_RAYDIUM" }
۲. ساخت/انتخاب ولت‌ها          → WALLET_GENERATION: TOKEN_OWNER + MARKET(N) + LIQUIDITY(1) خودکار
۳. پریفاند/فاندینگ ولت‌ها       → FUNDING: بر اساس strategy.liquidityWalletFundingSol + minFundedWalletUsd
۴. دیپلوی توکن                → TOKEN_LAUNCH: mint SPL + createPool Raydium (CustomLaunchSdkService)
۵. لاک لیکوئیدیتی              → LP در ولت LIQUIDITY می‌ماند؛ liquidityLockedAt ثبت می‌شود
۶. خرید توسط TOKEN_OWNER       → devBuySol طبق تنظیمات (best-effort — شکست آن لانچ را fail نمی‌کند)
۷. شروع مارکت‌میکینگ           → MARKET_MAKING: TradeEngineService مستقیم روی pool (نه Jupiter)
```

هر ۷ مرحله **همان state machine مشترک سیستم** (`PENDING → … → MARKET_MAKING → MONITORING → COMPLETED`) را طی می‌کنند — هیچ مسیر جدا/موازی برای CUSTOM_RAYDIUM نیست؛ فقط داخل هر step یک شاخه اضافه اجرا می‌شود.

### 26.3 مدل ولت — نقش چهارم

| نقش | Enum | تعداد در سیکل | Fund از | مقصد در Emergency |
|-----|------|----------------|---------|---------------------|
| Token Owner | `TOKEN_OWNER` | ۱ | Funding wallet | Sell + sweep (مثل بقیه) |
| Market | `MARKET` | N (طبق settings) | Funding wallet | Sell + sweep |
| **Liquidity** | `LIQUIDITY` | **۱ — فقط CUSTOM_RAYDIUM** | Funding wallet — `strategy.liquidityWalletFundingSol` (پیش‌فرض **۲.۳ SOL**، تلورانس پریفاند **۹۵٪**) | **آنلاک LP + sell + sweep** (بخش ۲۶.۶) |

### 26.4 Settings مرتبط

```json
{
  "integrations": {
    "runtime": {
      "customLaunch": {
        "totalSupply": "1000000000000000",
        "decimals": 6,
        "initialLiquiditySol": 2,
        "initialLiquidityTokenPercent": 80,
        "feeConfigIndex": 0,
        "slippageBps": 700,
        "emergencySlippageBps": 2500,
        "priorityFeeMicroLamports": 100000,
        "computeUnitLimit": 600000,
        "sellerFeeBasisPoints": 0,
        "devBuySol": 0.25,
        "httpTimeoutMs": 60000
      }
    }
  },
  "strategy": {
    "liquidityWalletFundingSol": 2.3,
    "defaultLaunchpad": "CUSTOM_RAYDIUM"
  }
}
```

`liquidityWalletFundingSol` باید کل این‌ها را پوشش دهد: seed اولیه pool (`initialLiquiditySol`) + rent دو حساب pool + fee پروتکل Raydium + بافر gas برای آنلاک/سویپ اضطراری آینده.

`defaultLaunchpad` تعیین می‌کند سیکل‌های بدون `forceLaunchpad` روی کدام لانچ‌پد لانچ شوند —
مقادیر مجاز: یک `Launchpad` مشخص (`"CUSTOM_RAYDIUM"` پیش‌فرض، یا `"PUMP_FUN"`/`"LETS_BONK"`/`"FOUR_MEME"`)
یا `"AUTO"` برای بازگشت به امتیازدهی خودکار قدیمی. مقدار نامعتبر/خالی هم مثل `"CUSTOM_RAYDIUM"` رفتار می‌شود (`resolveDefaultLaunchpadMode`).

### 26.5 اسکیمای DB — فیلدهای جدید `Token`

`totalSupply` (Decimal) · `decimals` (Int) · `mintAuthorityRevoked` / `freezeAuthorityRevoked` (Boolean) · `poolAddress` · `lpMint` · `poolTxHash` · `liquidityWalletId` (FK → `Wallet`) · `liquidityLockedAt` · `liquidityUnlockedAt` — همه فقط برای `launchpad = CUSTOM_RAYDIUM` پر می‌شوند؛ برای بقیه لانچ‌پدها `null`.

جزئیات کامل ERD در بخش ۱۰.۱.

### 26.6 ترمز اضطراری — رفتار اختصاصی ولت لیکوئیدیتی

طبق نیازمندی «هر مدل ترمز دستی کشیده شد باید ولت لیکوئیدیتی هم سریع انلاک کنه و سویپ بشه»:

```
POST /emergency/brake  (هر scope — GLOBAL یا CYCLE)
  → buildSellTargets()       : MARKET + TOKEN_OWNER معمولی (شامل CUSTOM_RAYDIUM هم می‌شود)
  → buildLiquidityUnlockTargets() : فقط ولت‌های LIQUIDITY سیکل‌های CUSTOM_RAYDIUM فعال
  → EmergencySellProcessor.runBrake:
      1. unlockAndSweepLiquidityWallets() — customLaunchSdk.unlockLiquidity → confirm →
         customLaunchSdk.sellAll (best-effort) → nativeSweep.sweepWallet → liquidityUnlockedAt
      2. sellAllForTarget برای بقیه targets (شامل CUSTOM_RAYDIUM با customLaunchSdk.sellAll)
```

همین مسیر (`unlockCustomLaunchLiquidity`) در **Treasury Full Drain** (`treasury-drain-runner.service.ts`) هم قبل از inventory scan اجرا می‌شود — یعنی drain کامل هم LP را آزاد و جارو می‌کند، نه فقط ترمز دستی.

### 26.7 یکپارچگی با موتور سود (بیشترین سود از بازار)

| مسیر سود | رفتار برای CUSTOM_RAYDIUM |
|-----------|----------------------------|
| **Market Making** (`TradeEngineService`) | خرید/فروش مستقیم روی pool رادیوم (نه Jupiter) — همان موتور ریاضی Blitz/Bot Magnet (بخش‌های ۱۹–۲۰) بدون تغییر اعمال می‌شود |
| **Liquidity ratio** (`market-generator.service.ts`) | چون bonding curve ندارد، از `liquidityAnalyzer.analyze()` استفاده می‌شود (مثل letsbonk) |
| **Profit Extractor** (creator cap ۱۰٪ + TWAP — بخش ۱۸) | `ProfitSellExecutorService` مستقیماً `customLaunchSdk.sell` صدا می‌زند؛ `TokenSupplyService` به‌جای GMGN/pump.fun از **totalSupply/decimals ذخیره‌شده در DB** استفاده می‌کند (منبع authoritative‌تر — بدون تأخیر ایندکس) |
| **Treasury Consolidate** (§21) | `ConsolidateExecutorService` هم همین branch را دارد — مقصد دستی هم پشتیبانی می‌شود |
| **سوشال‌ها** (twitter/telegram/website) | یک بار در `token-factory.service.ts` resolve می‌شود و بدون تغییر به هر سه لانچ‌پد (PUMP_FUN/LETS_BONK/CUSTOM_RAYDIUM) پاس داده می‌شود — در متادیتای IPFS (`buildLaunchpadIpfsMetadata`) و پیام توزیع (Distribution/Telegram) یکسان ظاهر می‌شود |

### 26.8 مرجع کد

| فایل | نقش |
|------|-----|
| `src/integrations/custom-launch/custom-launch-sdk.service.ts` | mint SPL + createPool + buy/sell/sellAll + unlockLiquidity |
| `src/modules/token-factory/token-factory.service.ts` | orchestration لانچ (createOnLaunchpad → CUSTOM_RAYDIUM branch) |
| `src/modules/market-generator/trade-engine.service.ts` | خرید/فروش مارکت‌میکینگ روی pool |
| `src/modules/profit-extractor/profit-sell-executor.service.ts` + `token-supply.service.ts` | فروش سود + resolve ساپلای از DB |
| `src/modules/emergency/emergency-brake-coordinator.service.ts` + `processors/emergency-sell.processor.ts` | targets + unlock/sweep/sell |
| `src/modules/treasury-lifecycle/treasury-drain-runner.service.ts` | unlock قبل از full drain |
| `src/modules/treasury-consolidator/consolidate-executor.service.ts` | sell دستی به مقصد دلخواه |
| `.cursor/skills/custom-raydium-launchpad/SKILL.md` + `reference.md` | مستند فنی کامل (agent skill) |
| [`manual-launchpad-frontend.md`](./manual-launchpad-frontend.md) | مستند فرانت‌اند — endpointها، DTOها، چک‌لیست UI |

### 26.9 محدودیت‌های شناخته‌شده

- بدون on-chain time-lock قراردادی روی LP — امنیت بر مبنای کنترل custodial کلید ولت پلتفرم است (نه قابل‌ادعا به کاربران به‌عنوان «trustless lock»).
- Dev buy (مرحله ۶) و فروش بعد از آنلاک، **best-effort** هستند — شکست آن‌ها کل لانچ/ترمز را fail نمی‌کند (لاگ warning).
- تازه بعد از ساخت pool، GMGN ممکن است چند دقیقه طول بکشد ایندکس کند — `liquidityRatio` و بعضی متریک‌های visibility در همین بازه ۰ نشان داده می‌شوند (مثل letsbonk).

---

*پایان سند — v3.1 Production Hardened + Manual Launchpad (CUSTOM_RAYDIUM)*
