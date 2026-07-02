# راهنمای فرانت — Emergency · Treasury · Drain

**مخاطب:** تیم Frontend / Admin Panel  
**Base URL:** `/api/v1`  
**Auth:** همه endpointهای زیر (به‌جز health عمومی) نیاز به `X-API-Key` دارند.

> این سند منبع حقیقت UI برای فلوهای «توقف اضطراری»، «خالی‌کردن ولت‌ها» و «جمع‌آوری سود» است.  
> آخرین هم‌ترازی با کد: ژوئن ۲۰۲۶.

---

## ۱. مدل ولت — قبل از هر UI

سیستم **دو نقش ولت** دارد؛ اشتباه گرفتن آن‌ها باعث UI گمراه‌کننده می‌شود.

| نقش | Settings | نمایش در API | کاربرد |
|-----|----------|--------------|--------|
| **Funding** | `integrations.mainFeeWalletEvmPrivateKey` | `GET /main-fee-wallet` → `fundingAddress`, `balanceUsdc`, `balanceEth`, `fundingTotalUsd`, `totalUsd` | ChangeNOW → شارژ market wallets (فقط Ethereum USDC/ETH) |
| **Withdrawal (سود)** | `integrations.nativeWithdrawalSolanaAddress` | `nativeWithdrawalSolanaAddress`, `balanceSol` | مقصد sweep اضطراری / drain / profit |
| **Withdrawal (سود)** | `integrations.nativeWithdrawalBscAddress` | `nativeWithdrawalBscAddress`, `balanceBnb` | همان برای BSC |

**قوانین سخت:**

- Sweep **هرگز** به آدرس funding نمی‌رود.
- `bscAddress` در پاسخ main-fee = همان `fundingAddress` (EVM funding) — **نه** آدرس برداشت BSC.
- `solanaAddress` (deprecated) = `nativeWithdrawalSolanaAddress`.

### `GET /main-fee-wallet` — فیلدهایی که Dashboard باید نشان دهد

```json
{
  "fundingAddress": "0x…",
  "ethAddress": "0x…",
  "bscAddress": "0x…",
  "nativeWithdrawalSolanaAddress": "EDJS…",
  "nativeWithdrawalBscAddress": "0xdd6B…",
  "balanceSol": "12.45",
  "balanceBnb": "0.85",
  "balanceUsdc": "1500.00",
  "balanceEth": "0.85",
  "fundingTotalUsd": 1585.7,
  "withdrawalTotalUsd": 2135.8,
  "totalUsd": 1585.7,
  "isReadyForRearm": true,
  "minRearmBalanceUsd": 5000,
  "isLowBalance": false,
  "balancesRefreshedAt": "2026-06-25T12:00:00.000Z"
}
```

| فیلد UI | معنی |
|---------|------|
| `fundingTotalUsd` / `totalUsd` | آمادگی rearm / funding — **USDC+ETH روی Ethereum** |
| `withdrawalTotalUsd` | سود جمع‌شده — **SOL+BNB روی آدرس‌های withdrawal** (تقریبی USD) |
| `balanceSol` / `balanceBnb` | موجودی روی withdrawal addresses |
| `balanceUsdc` / `balanceEth` | موجودی روی funding address |

**محدودیت فعلی (برای copy در UI):** بعد از `convertTo: USDC`، USDC واقعی روی همان ولت withdrawal است (SPL روی Solana، BEP-20 روی BSC) ولی `withdrawalTotalUsd` هنوز فقط native را می‌شمارد — عدد USD ممکن است پس از convert کامل نباشد.

### `GET /settings` — integrations مرتبط

```json
{
  "integrations": {
    "nativeWithdrawalSolanaAddress": "EDJS…",
    "nativeWithdrawalBscAddress": "0xdd6B…",
    "nativeWithdrawalSolanaPrivateKey": "***",
    "nativeWithdrawalBscPrivateKey": "***",
    "jupiterApiKey": "***",
    "mainFeeWalletEvmPrivateKey": "***",
    "endpoints": { "jupiterQuoteApiUrl": "https://api.jup.ag" },
    "runtime": { "jupiter": { "slippageBps": 100, "minSwapSolReserve": 0.02 } }
  },
  "treasury": {
    "lifecycle": { "defaultDrainConvertTo": "NATIVE" },
    "consolidate": { "defaultConvertTo": "NATIVE", "defaultSlippageBps": 1500 }
  }
}
```

**PATCH /settings:**

- فیلدهای `***` را **هرگز** در body برنگردانید — backend آن‌ها را strip می‌کند؛ ارسال عمدی `***` قبلاً کلید withdrawal را خراب می‌کرد (fix شده).
- آدرس‌های withdrawal قابل ویرایش و **mask نمی‌شوند**؛ private keyها فقط `***`.

---

## ۲. سه عملیات جدا — کدام دکمه چه می‌کند؟

| عملیات | Endpoint | مقصد پول | Halt سیستم؟ |
|--------|----------|----------|-------------|
| **Emergency brake** | `POST /emergency/brake` | withdrawal wallets | بله (`halted: true`) |
| **Treasury drain** | `POST /treasury/drain` | withdrawal wallets (خودکار از settings) | اختیاری (pause طبق settings) |
| **Treasury consolidate** | `POST /treasury/consolidate` | `destinationAddress` دستی | خیر (مگر همزمان brake) |

### `convertTo` — رفتار یکسان در هر سه

| مقدار | نتیجه |
|-------|--------|
| `NATIVE` (پیش‌فرض drain) | SOL/BNB روی withdrawal — برداشت دستی توسط اپراتور |
| `USDC` | SOL→USDC (Jupiter روی Solana withdrawal) · BNB→USDC (ChangeNOW روی BSC withdrawal) |

**پیش‌نیاز `convertTo: USDC`:**

| شبکه | Secret لازم | سرویس |
|------|-------------|--------|
| SOLANA | `nativeWithdrawalSolanaPrivateKey` + `jupiterApiKey` | Jupiter Swap API v2 |
| BSC | `nativeWithdrawalBscPrivateKey` | ChangeNOW |

اگر کلید نباشد، convert **skip** می‌شود (job ادامه می‌یابد؛ در log دلیل برمی‌گردد).

---

## ۳. Emergency (`/emergency`)

### ۳.۱ Global banner — همه صفحات

```
GET /emergency/halt   (poll هر 10s)
```

```json
{
  "halted": true,
  "halt": { "jobId": "emergency_…", "reason": "…", "since": "…" },
  "emergencyLock": "emergency_…"
}
```

| `halted` | UI |
|----------|-----|
| `true` | بنر قرمز · disable «Start Cycle» · نشان دادن Resume |
| `false` | بدون بنر |

### ۳.۲ `POST /emergency/brake`

**Body (`ManualBrakeDto`):**

```json
{
  "scope": "GLOBAL",
  "cycleId": null,
  "convertTo": "NATIVE",
  "fullDrain": false,
  "reason": "توضیح اجباری برای اپراتور"
}
```

| فیلد | توضیح |
|------|--------|
| `scope` | `GLOBAL` \| `CYCLE` — برای `CYCLE` حتماً `cycleId` |
| `convertTo` | `NATIVE` \| `USDC` — **`convertToUsdc` deprecated**؛ استفاده نکنید |
| `fullDrain` | `true` + `GLOBAL` → فقط drain کل سیستم (بدون sell محدود به targets فوری) |
| `fullDrain` | `true` + `CYCLE` → sell targets آن cycle + chain drain |

**Response — حالت‌های `mode`:**

| `mode` | معنی |
|--------|------|
| `SELL_SWEEP` | فروش توکن‌های target → sweep native به withdrawal |
| `SELL_SWEEP_DRAIN` | مثل بالا + drain زنجیره‌ای برای cycle |
| `FULL_DRAIN` | halt سراسری + `POST /treasury/drain` داخلی (`drainJobId` جدا) |

نمونه:

```json
{
  "jobId": "emergency_1719312345_1234",
  "status": "QUEUED",
  "mode": "SELL_SWEEP",
  "convertTo": "NATIVE",
  "fullDrain": false,
  "walletsAffected": 150,
  "sellTargets": 148,
  "liquidityWalletsUnlocking": 1,
  "ownerLiquidityWalletsUnlocking": 1,
  "message": "Emergency brake: sell all tokens → sweep SOL/BNB to native withdrawal wallets"
}
```

> `liquidityWalletsUnlocking`/`ownerLiquidityWalletsUnlocking` فقط برای سیکل‌های `CUSTOM_RAYDIUM` غیرصفر می‌شوند — جزئیات کامل در [`ui-owner-liquidity-auto-lock.md`](./ui-owner-liquidity-auto-lock.md) §۵.۲ و [`manual-launchpad-frontend.md`](./manual-launchpad-frontend.md) §۷.

با `fullDrain: true` + `GLOBAL`:

```json
{
  "jobId": "emergency_…",
  "drainJobId": "drain_…",
  "status": "QUEUED",
  "mode": "FULL_DRAIN",
  "systemHalted": true
}
```

→ در این حالت progress را با **`GET /treasury/lifecycle/{drainJobId}`** poll کنید (نه فقط brake).

### ۳.۳ Poll brake

```
GET /emergency/brake/{jobId}   (هر 3s)
```

```json
{
  "jobId": "emergency_…",
  "status": "RUNNING",
  "scope": "GLOBAL",
  "systemHalted": true,
  "walletsAffected": 150,
  "progress": {
    "walletsProcessed": 75,
    "walletsSold": 73,
    "walletsFailed": 2
  },
  "usdRecovered": 1250.5,
  "durationMs": 45000
}
```

**Terminal statuses:** `COMPLETED` · `PARTIAL` · `FAILED` · `DRAINED_HALTED` (تکمیل + هنوز halt)

`usdRecovered` از delta `withdrawalTotalUsd` یا estimate native است — برای نمایش کلی کافی است.

### ۳.۴ Resume

```
POST /emergency/resume
{ "jobId": "<همان jobId brake>" }
```

فقط وقتی `halted: true`. بعد از موفقیت دوباره `GET /emergency/halt` → `halted: false`.

---

## ۴. Treasury Drain / Lifecycle (`/treasury`)

### ۴.۱ `POST /treasury/drain`

خالی کردن **همه ولت‌های فعال** (market + owner) → withdrawal addresses از settings.

```json
{
  "scope": "GLOBAL",
  "networks": ["SOLANA", "BSC"],
  "convertTo": "NATIVE",
  "includeOwnerWallets": true,
  "reason": "Scheduled drain"
}
```

| فیلد | پیش‌فرض | توضیح |
|------|---------|--------|
| `convertTo` | از `settings.treasury.lifecycle.defaultDrainConvertTo` (`NATIVE`) | |
| `scope` | `GLOBAL` | `CYCLE` نیاز `cycleId` |
| `includeOwnerWallets` | `true` | owner wallets در inventory |

**Response:**

```json
{
  "jobId": "drain_1719312345_5678",
  "phase": "DRAINING",
  "status": "QUEUED"
}
```

**Poll:**

```
GET /treasury/lifecycle/{jobId}   (هر 5s)
```

```json
{
  "jobId": "drain_…",
  "phase": "DRAINING",
  "status": "RUNNING",
  "mainFeeUsdBefore": 1200.5,
  "mainFeeUsdAfter": 3450.2,
  "errorMessage": null,
  "createdAt": "…",
  "completedAt": null
}
```

> **نام‌گذاری API:** `mainFeeUsdBefore` / `mainFeeUsdAfter` در lifecycle job در عمل **مجموع USD ولت‌های withdrawal** (قبل/بعد drain) است — نه funding wallet. در UI برچسب بزنید: «Withdrawal total USD».

**Phases:** `DRAINING` → `READY` (drain تنها) · یا `WAITING_DEPOSIT` → `REARMING` (lifecycle/run)

**Conflict 409:** اگر lifecycle job دیگری `QUEUED`/`RUNNING` باشد.

### ۴.۲ `POST /treasury/rearm`

بعد از drain؛ ولت‌های جدید + funding از **funding wallet** (`POST /main-fee-wallet/fund` داخلی).

```json
{
  "walletPoolStrategy": "AUTO",
  "marketWalletCount": 150,
  "sourceAsset": "USDC",
  "amountPerWalletUsd": 0.1,
  "skipIfBalanceInsufficient": true,
  "startCycleAfterRearm": false
}
```

Poll همان `GET /treasury/lifecycle/{jobId}`.

### ۴.۳ `POST /treasury/lifecycle/run` — یک‌کلیک

```json
{
  "drain": { "scope": "GLOBAL", "convertTo": "NATIVE" },
  "waitForDeposit": { "enabled": true, "minBalanceUsd": 1000, "timeoutMinutes": 60 },
  "rearm": { "walletPoolStrategy": "AUTO", "marketWalletCount": 150 },
  "startCycleAfterRearm": true
}
```

فلو: **DRAINING** → **WAITING_DEPOSIT** (منتظر `fundingTotalUsd`) → **REARMING** → **READY** / **FAILED**

---

## ۵. Treasury Consolidate — ops پیشرفته

وقتی اپراتور **مقصد دستی** می‌خواهد (نه پیش‌فرض settings):

```
POST /treasury/consolidate
GET /treasury/consolidate/{jobId}
```

```json
{
  "scope": "GLOBAL",
  "networks": ["SOLANA", "BSC"],
  "destinationAddress": {
    "SOLANA": "EDJSqWe4ZGybBwzSc4VEy9BvdXTpCmFM6VWbg6vP959u",
    "BSC": "0xdd6B4Aba9E12cB4C804063c3935653de894bA756"
  },
  "convertTo": "NATIVE",
  "sellAllTokens": true,
  "minSweepUsd": 0.5,
  "slippageBps": 1500,
  "reason": "Custom destination consolidate"
}
```

**اعتبارسنجی:** destination نباید آدرس funding EVM باشد (BSC).

**⚠️ `includeMainFeeWallet`:** در DTO/swagger هست ولی **در backend پیاده‌سازی نشده** — در UI نشان ندهید یا disabled با tooltip «not implemented».

**Poll:** `GET /treasury/consolidate/{jobId}` هر 5s تا `COMPLETED`/`PARTIAL`/`FAILED`.

---

## ۶. Settings مرتبط — فرم Treasury در پنل

از `GET /settings` بخوانید؛ با `PATCH` فقط فیلدهای تغییرکرده:

```json
{
  "treasury": {
    "lifecycle": {
      "defaultDrainConvertTo": "NATIVE",
      "autoPauseCyclesOnDrain": true,
      "minRearmBalanceUsd": 5000,
      "autoDrain": {
        "enabled": true,
        "everyNCycles": 6,
        "convertTo": "NATIVE"
      }
    },
    "consolidate": {
      "defaultConvertTo": "NATIVE",
      "defaultSlippageBps": 1500,
      "minSweepUsd": 0.5
    }
  },
  "integrations": {
    "nativeWithdrawalSolanaAddress": "…",
    "nativeWithdrawalBscAddress": "…"
  }
}
```

---

## ۷. Health قبل از عملیات خطرناک

```
GET /integrations/health
```

Providerهای مرتبط:

| Provider | برای |
|----------|------|
| `jupiter` | `convertTo: USDC` روی Solana |
| `changenow` | `convertTo: USDC` روی BSC + funding |
| `solana-rpc` / `bsc-rpc` | sweep + convert |

اگر `jupiter` یا `changenow` = `degraded`/`down` → قبل از brake با `convertTo: USDC` هشدار بدهید.

---

## ۸. نقشه صفحات پیشنهادی UI

### `/emergency`

| المان | API |
|--------|-----|
| وضعیت halt | `GET /emergency/halt` |
| فرم brake | `POST /emergency/brake` |
| Progress | `GET /emergency/brake/:jobId` |
| Resume | `POST /emergency/resume` |
| لینک withdrawal | `GET /main-fee-wallet` |

**فرم brake پیشنهادی:**

- Radio `convertTo`: NATIVE (default) / USDC
- Checkbox `fullDrain` با confirm اضافی برای GLOBAL
- Textarea `reason` اجباری
- Scope GLOBAL / CYCLE (+ cycle picker)

### `/treasury`

| تب | API |
|----|-----|
| Drain | `POST /treasury/drain` → poll lifecycle |
| Rearm | `POST /treasury/rearm` → poll lifecycle |
| Full lifecycle | `POST /treasury/lifecycle/run` → poll lifecycle |
| Advanced consolidate | `POST /treasury/consolidate` → poll consolidate |

**نمایش موجودی:**

- کارت Funding → `fundingTotalUsd`, `balanceUsdc`, `balanceEth`
- کارت Profit / Withdrawal → `withdrawalTotalUsd`, `balanceSol`, `balanceBnb`, آدرس‌ها

### Dashboard (خلاصه)

- Banner halt
- دو KPI: Funding vs Withdrawal USD
- دکمه‌های shortcut به Emergency / Treasury (با confirm)

---

## ۹. Polling — جدول نهایی

| Context | Endpoint | Interval | Stop when |
|---------|----------|----------|-----------|
| Halt banner | `GET /emergency/halt` | 10s | — |
| Emergency brake | `GET /emergency/brake/:jobId` | 3s | terminal |
| Drain / lifecycle / rearm | `GET /treasury/lifecycle/:jobId` | 5s | `COMPLETED` / `FAILED` / `READY` |
| Consolidate job | `GET /treasury/consolidate/:jobId` | 5s | terminal |
| Main fee balances | `GET /main-fee-wallet` | 30s | — |

---

## ۱۰. خطاهای رایج UI

| HTTP | علت | UI |
|------|-----|-----|
| 409 | brake یا lifecycle در جریان | «عملیات دیگری در حال اجراست» |
| 404 | `cycleId` برای scope CYCLE | validation فرم |
| 409 resume | halt مربوط به job دیگر | نشان دادن `emergencyLock` |
| convert skipped | کلید Jupiter/withdrawal نیست | toast + لینک Settings |

---

## ۱۱. تفاوت با مستندات قدیمی (migration checklist فرانت)

- [ ] دیگر sweep به `mainFeeWallet` / `bscAddress` funding **نمایش داده نشود** به‌عنوان مقصد سود
- [ ] `convertToUsdc` حذف از فرم‌ها → فقط `convertTo`
- [ ] `fullDrain` + GLOBAL → poll `drainJobId` از پاسخ brake
- [ ] lifecycle `mainFeeUsd*` → برچسب «Withdrawal USD»
- [ ] `includeMainFeeWallet` از consolidate form حذف/shown as N/A
- [ ] Settings PATCH: strip فیلدهای `***`
- [ ] نمایش `nativeWithdrawalSolanaAddress` / `nativeWithdrawalBscAddress` در Treasury settings
- [ ] `jupiter` در integrations health table

---

**مرجع تکمیلی:** `docs/admin-panel-spec.md` §۴ و §۵ · OpenAPI: `/api/docs`
