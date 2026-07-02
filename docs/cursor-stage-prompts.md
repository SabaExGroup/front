# پرامپت‌های مرحله‌ای Cursor — کپی و بفرست

> **نسخه:** 3.0 — **BUILD ۰–۱۲ ✅ تمام** · تمرکز روی **Go-Live اپراتور (فاز A–D)**  
> هر پرامپت را در یک چت Agent بفرست. مرجع: [`implementation-roadmap.md`](./implementation-roadmap.md) v3.0 · [`cost-model.md`](./cost-model.md) · [`external-integrations.md`](./external-integrations.md)

---

## وضعیت — یک نگاه

| فاز | محتوا | وضعیت |
|-----|--------|--------|
| **نوبت ۰–۱۲** | ساخت ماژول · on-chain · poll · ledger | ✅ **تمام** (۲۰۲۶-۰۶-۲۲+) |
| **Hardening v3** | budget guard · emergency halt · creator 10% · market TWAP floor | ✅ |
| **فاز A–D** | keys · Main Fee · test cycle · $5K production · drain/cron | ⏳ **اپراتور** |

```
npm test    → 119 passed
npm run build → سبز
```

**دیگر نوبت ۱–۱۲ را برای build تکرار نکن** — مگر regression. از **پرامپت‌های اپراتور** زیر استفاده کن.

---

## ⬇️ پرامپت‌های اپراتور — فاز A–D (کپی کن)

### فاز A — Pre-flight

```
فاز A — Pre-flight قبل از اولین پول.

مرجع: docs/implementation-roadmap.md فاز A · docs/external-integrations.md §0 · docs/cost-model.md

1. PATCH /settings — کلیدهای live (جدول external-integrations §0.2)
2. npm run validate:integrations && npm test (119 pass)
3. GET /integrations/health + /integrations/rpc/health
4. GET /main-fee-wallet — bscAddress = mainFeeWalletEvmPrivateKey
5. شارژ: 65% USDC@ETH + 25% ETH@ETH (~$150 min) روی Ethereum
6. npm run start:api + npm run start:worker
7. Telegram test

Acceptance: health سبز · worker up · settings PATCH (نه فقط defaults.json)
```

### فاز B — تست ۵ wallet

→ پایین فایل: «پرامپت تست یکپارچه (فاز B)»

### فاز C — Production $5K

→ پایین فایل: «پرامپت production (فاز C)»

### فاز D — اتوماسیون

```
فاز D — cron · drain · emergency policy.

تأیید: cronExpression از settings · minRearmBalanceUsd 5000
drain هر ۵–۱۰ چرخه: POST /treasury/lifecycle/run
emergency فقط panic — GET /emergency/halt · POST /resume
sellInRed: false — هرگز true نکن
```

### Debug — ChangeNOW fail

```
FundingTransaction FAILED — debug ChangeNOW.

1. failureReason — "below ChangeNOW minimum"؟ → cost-model § ChangeNOW
2. ETH@Ethereum balance — ۲۰۱ deposit gas (~$80–350/cycle)
3. USDC balance — کافی برای sum funding؟
4. ethereum RPC health
مرجع: external-integrations.md §3.4 · changenow-funding.service.ts
```

### Debug — Bot Magnet miss

```
Signal Bundle < 12 GREEN.

چک: marketWalletCount 200 · tpm 150 · minVolume5mUsd 100000
QuickNode Solana · worker · CycleLog greenCount
مرجع: main-info.md §20
```

---

## آرشیو BUILD — نوبت ۰–۱۲ (✅ تمام)

> فقط regression / audit — برای go-live از پرامپت‌های بالا استفاده کن.

---

## نوبت ۰ — integrations · settings · common (فقط اگر health قرمز است)

**وضعیت: ✅ تکمیل شده + hardened (۲۰۲۶-۰۶-۲۲)**

Acceptance تأییدشده:
- `npm run build` سبز
- `npm run test` — unit tests برای validator، patch masking، probe util
- `npm run validate:integrations` — `validateMergedIntegrations(docs/settings.defaults.json)` + reject invalid RPC
- PATCH با `ethereumRpcUrl` نامعتبر → `400` (validator)
- `stripMaskedIntegrationPatch` — `***` و RPC ماسک‌شده overwrite نمی‌کنند
- Health عمومی بدون API key: `/api/v1/health`, `/api/v1/integrations/health`, `/api/v1/integrations/rpc/health`
- Health probes: timeout 12s، placeholder keys/RPC → `degraded` فوری (بدون hang)
- LetsBonk health فقط config؛ PumpPortal HTTP probe واقعی
- OpenAPI: `IntegrationsHealthSnapshot`, PATCH `400`, `ethereum` در RpcHealth, `checkedAt` در HealthResponse
- `IntegrationsCacheInvalidator` بعد از PATCH — RPC/GMGN cache invalidate

**برای تست runtime:**
```bash
docker compose up -d postgres redis
npm run build && npm run validate:integrations && npm test
npm run start:prod
curl -s localhost:5420/api/v1/health | jq
curl -s localhost:5420/api/v1/integrations/health | jq
curl -s localhost:5420/api/v1/integrations/rpc/health | jq
```

دو fix DI برای boot: `WalletGeneratorModule` → RPC modules؛ `TokenFactoryModule` → export `LaunchpadSelectorService`.

```
نوبت ۰ — فقط اگر integrations/settings/common مشکل دارد.

Workspace: /Users/artanzh/Desktop/token-platform

وضعیت: integrations و settings تقریباً تمام‌اند. این نوبت را فقط اگر یکی از این‌ها fail می‌کند اجرا کن:
- GET /health
- GET /integrations/health
- GET /integrations/rpc/health
- PATCH /settings با config نامعتبر (باید 400 بدهد)

کار:
1. مشکل health را پیدا و رفع کن (src/integrations، src/modules/settings، src/common).
2. npm run build باید سبز بماند.
3. docs/settings.defaults.json و integrations-config.validator را نقض نکن.

محدوده: فقط فایل‌های لازم برای health سبز — به main-fee-wallet و core-trigger دست نزن.

Acceptance:
- هر چهار endpoint بالا up/degraded قابل قبول (نه همه down).
- build سبز.
```

---

## نوبت ۱ — main-fee-wallet

**وضعیت: ✅ تکمیل شده + hardened (۲۰۲۶-۰۶-۲۲)**

پیاده‌سازی:
- EVM address از `mainFeeWalletEvmPrivateKey` (نه generate تصادفی) — `common/crypto/evm-wallet.util.ts`
- `refreshBalancesFromChain`: USDC اتریوم + ETH native + SOL/BNB + `totalUsd` با `NativeTokenPriceService`
- `FundingProcessor`: poll تا COMPLETED/FAILED + `failureReason` + ledger OUT (idempotent) + balance refresh
- Idempotency: skip walletهای COMPLETED/PROCESSING؛ stale PROCESSING → FAILED؛ ledger duplicate-safe
- `getRefundAddress` هم‌تراز با کلید settings
- Prisma: `failureReason`, `updatedAt` روی `FundingTransaction`
- `POST /main-fee-wallet/fund` → HTTP 202
- Unit tests: `funding-transaction.util`, `evm-wallet.util`

**تست دستی:** worker (`npm run start:worker`) + کلیدهای واقعی + `docker compose up`

```
نوبت ۱ — main-fee-wallet را ۱۰۰٪ production کن.

Workspace: /Users/artanzh/Desktop/token-platform
مرجع: docs/implementation-roadmap.md گام ۱ · docs/main-info.md §3.1 · docs/external-integrations.md (ChangeNOW)

محدوده کد:
- src/modules/main-fee-wallet/*
- استفاده از src/integrations/changenow/changenow-funding.service.ts
- prisma: FundingTransaction، MainWalletLedger، MainFeeWallet

کارهای الزامی:
1. بعد از ChangeNOW، هر FundingTransaction تا status=COMPLETED poll شود (یا FAILED با دلیل) — نه فقط queue.
2. هر funding موفق → ردیف MainWalletLedger (debit از main fee، referenceType funding).
3. balanceUsdc / balanceSol / balanceBnb / totalUsd از chain + NativeTokenPriceService به‌روز شود (نه فقط DB دستی).
4. کلید EVM برای deposit از integrations.mainFeeWalletEvmPrivateKey (IntegrationsConfigService) — نه generate تصادفی هر بار.
5. funding.processor.ts و main-fee-wallet.service.ts هماهنگ با changenow-funding retry از runtime.changeNow.

محدودیت:
- core-trigger را در این نوبت تغییر نده (نوبت ۲).
- scope کم — فقط main-fee-wallet و wire لازم.

Acceptance:
- npm run build سبز
- GET /main-fee-wallet موجودی منطقی
- تست دستی: ۱–۳ ولت fund → همه FundingTransaction COMPLETED در DB
- MainWalletLedger حداقل یک debit
- خطاها typed (نه throw new Error خام)
```

---
 
## نوبت ۲ — core-trigger (funding gate)

**وضعیت: ✅ تکمیل شده + hardened (۲۰۲۶-۰۶-۲۲)**

پیاده‌سازی:
- `FundingGateService` — poll `FundingTransaction` تا همه `COMPLETED` یا `FAILED`/timeout
- **Race fix:** منتظر ثبت `FundingTransaction` توسط worker قبل از gate اصلی
- `runFundingStep` — بعد از queue، gate block می‌کند؛ فقط بعد COMPLETED → `TOKEN_LAUNCH`
- **`validateFundingBudget`** — upfront funding ≤85% `maxInvestmentUsd` (v3)
- `dryRun` — funding واقعی skip می‌شود
- timeout/interval از `runtime.changeNow.pollTimeoutMs` / `pollIntervalMs`
- `failCycle` + try/catch — step fail → `FAILED` + `CycleLog` + TG با `failedStep` دقیق
- `CoreTriggerScheduler` — cron از `settings.cronExpression`؛ refresh بعد از PATCH settings
- خطاهای typed: `core-trigger.errors.ts` (+ `CoreTriggerConfigurationError`)
- Unit tests: `funding-gate.util`, `cycle-state.machine`

```
نوبت ۲ — core-trigger: منتظر funding بمان.

Workspace: /Users/artanzh/Desktop/token-platform
مرجع: docs/main-info.md §23.2 مرحله ۵ FUNDING · implementation-roadmap گام ۲

محدوده:
- src/modules/core-trigger/core-trigger.service.ts (runFundingStep)
- src/modules/core-trigger/core-trigger.scheduler.ts
- src/modules/core-trigger/cycle-state.machine.ts (در صورت نیاز FAILED)
- prisma FundingTransaction

مشکل فعلی:
runFundingStep() فقط queueFundingJobs می‌کند و بلافاصله مرحله بعد می‌رود — ولت‌ها خالی می‌مانند.

کار:
1. بعد از queueFundingJobs، poll FundingTransaction این cycleId تا همه COMPLETED یا یکی FAILED/timeout.
2. timeout از runtime.changeNow.pollTimeoutMs (settings).
3. اگر fail/timeout → cycle status FAILED + CycleLog.
4. فقط بعد از همه COMPLETED → transition به TOKEN_LAUNCH.
5. CoreTriggerScheduler: cron از settings.cronExpression (نه hardcode 0 */4).
6. exception handling: step fail → FAILED نه hang.

محدودیت:
- security-check wire نکن (نوبت ۳).
- market-generator دست نزن.

Acceptance:
- build سبز
- POST /core-trigger/cycles با ۵ ولت → در FUNDING می‌ماند تا funding تمام شود
- بعد COMPLETED → ادامه state machine
- fail ChangeNOW → cycle FAILED
```

---
 
## نوبت ۳ — security-check

**وضعیت: ✅ تکمیل شده + hardened (۲۰۲۶-۰۶-۲۲)**

پیاده‌سازی:
- `SecurityCheckProcessor` → `runCycleSecurityGate` (GMGN security + info + scorer)
- Benchmark address از GMGN trending (فیلتر launchpad) — `security-gate.util.ts`
- `SecurityReport` + planned `Token` قبل از لانچ؛ **failed gate هم report persist** (audit)
- Gate fail → `SecurityCheckGateError` → `CoreTriggerStepError(SECURITY_CHECK)` → `FAILED`
- `GET` + `POST` `/security/check`
- Unit tests: `security-gate.util`

```
نوبت ۳ — security-check را به چرخه وصل کن (gate قبل از لانچ).

Workspace: /Users/artanzh/Desktop/token-platform
مرجع: docs/main-info.md §23.2 مرحله ۴ · §11 · external-integrations GMGN security

محدوده:
- src/modules/core-trigger/processors/security-check.processor.ts
- src/modules/security-check/security-check.service.ts
- prisma SecurityReport، Token

مشکل فعلی:
SecurityCheckProcessor فقط securityMinScore range را چک می‌کند — GMGN صدا زده نمی‌شود.

کار:
1. Processor → SecurityCheckService (GMGN /v1/token/security + scorer).
2. قبل از TOKEN_LAUNCH: برای آدرس/ترند مربوطه score بگیر (یا mock address از trend package تا token ساخته شود — منطق درست با flow §23).
3. نتیجه در SecurityReport persist (tokenId وقتی token وجود دارد).
4. اگر score < settings.securityMinScore → cycle FAILED + log (مطابق §23.4 Security fail).
5. اگر isSafe=false → FAILED.

Acceptance:
- build سبز
- cycle با token risky → FAILED قبل از لانچ
- SecurityReport ردیف در DB بعد از check موفق
- GET /security/check همچنان کار کند
```

---

## نوبت ۴ — wallet-generator

**وضعیت: ✅ تکمیل شده + hardened (۲۰۲۶-۰۶-۲۲)**

پیاده‌سازی:
- `refreshWalletBalance` — RPC (Redis cache 5s via `REDIS_KEYS.rpcBalance`) + `NativeTokenPriceService` → `balanceUsd`
- `forceRefresh` برای `assertWalletFunded` — cache invalidate قبل از trade (جلوگیری از stale 0 بعد از funding)
- `GET /wallets/:id` و `/balance` — refresh با respect به cache + `fromCache` flag
- `refreshWalletBalances` — batch با concurrency 12
- `assertWalletFunded(walletId, minUsd)` — market-generator + token-factory
- `wallet-generator.errors.ts` — `WalletNotFundedError`, `WalletBalanceRefreshError`, `WalletInvalidAddressError`
- Unit tests: `wallet-balance.util`

```
نوبت ۴ — wallet-generator: balance واقعی.

Workspace: /Users/artanzh/Desktop/token-platform
مرجع: docs/main-info.md §3.3

محدوده:
- src/modules/wallet-generator/wallet-generator.service.ts
- src/modules/wallet-generator/wallet-generator.controller.ts
- integrations: SolanaRpcClient، BscRpcClient، NativeTokenPriceService

کار:
1. refresh balanceNative از RPC (getBalance).
2. balanceUsd از native USD price service.
3. endpoint موجود balance را cache/redis در صورت وجود respect کند.
4. helper: assertWalletFunded(walletId, minUsd) برای استفاده بعدی market-generator.
5. deposit/withdraw/transfer کامل §3.3.2 — فقط اگر برای MVP لازم است؛ اولویت balance refresh.

Acceptance:
- build سبز
- GET /wallets/{id} بعد از funding نوبت ۱–۲ balance > 0
- balance با explorer/RPC match (تقریبی)
```

---

## نوبت ۵ — token-factory

**وضعیت: ✅ تکمیل شده + hardened (۲۰۲۶-۰۶-۲۲)**

پیاده‌سازی:
- قبل از `createToken`: `assertWalletFunded` با `computeOwnerLaunchFundingUsd` (dev buy + fees)
- Security gate: `passesTokenLaunchSecurityGate` — `isSafe` + `score >= securityMinScore`
- `launchpad-selector` — GMGN + liquidity از settings (بدون hardcode) + Redis cache 60s
- On-chain verify: `hasConfirmedTransaction` / `hasSuccessfulTransaction` قبل از persist
- Crash recovery: Redis `token:launch:pending` — retry بدون duplicate on-chain launch
- Concurrency: Redis lock `token:launch:lock` — جلوگیری از double launch
- DB persist: `address`, `launchTxHash`, `launchedAt`, `launchpad`, `network` + explorer URLs
- `dryRun` path حفظ شده
- `TokenLaunchProcessor` + `runTokenLaunchStep` → `CoreTriggerStepError('TOKEN_LAUNCH')`
- Unit tests: `token-launch.util`, `launchpad-selector.util`, `owner-launch-funding.util`

```
نوبت ۵ — token-factory: لانچ on-chain production. [تکمیل شد]

Workspace: /Users/artanzh/Desktop/token-platform
مرجع: docs/main-info.md §3.4 · external-integrations pump/fourmeme/letsbonk

محدوده:
- src/modules/token-factory/*
- src/modules/core-trigger/processors/token-launch.processor.ts
- integrations: PumpFunSdkService، LetsBonkSdkService، FourMemeChainService

کار:
1. قبل createToken: owner wallet باید funded باشد (از wallet-generator یا RPC check). ✅
2. بعد security pass (نوبت ۳). ✅
3. launchpad-selector از settings + GMGN — بدون hardcode. ✅
4. Token در DB: mint/contractAddress، txHash، network، launchpad — همه پر. ✅
5. dry-run path حفظ شود. ✅

Acceptance:
- build سبز ✅
- cycle non-dry-run → Token با txHash واقعی on-chain
- explorer/Solscan یا pump.fun قابل verify
```

---

## نوبت ۶ — trend-finder

**وضعیت: ✅ تکمیل شده + hardened (۲۰۲۶-۰۶-۲۲)**

پیاده‌سازی:
- Retry با exponential backoff + `Retry-After` / GMGN `resetAt` — OpenAI (TOPIC/IDENTITY/DESCRIPTION/LOGO) + GMGN symbol check
- `OpenAiConfigurationError` — non-retryable؛ rate limit/5xx — retry تا 4 attempt
- Symbol collision recovery: `symbolAlternatives` → regenerate identity با exclude list
- Famous ticker blocklist (BTC, ETH, PEPE, …)
- Logo dedup: Redis NX + retry با variant prompt
- Redis lock `trend:generate:lock` — جلوگیری از double generation
- `TrendGenerationProcessor` → CycleLog واضح per step/error
- `runTrendGenerationStep` → `CoreTriggerStepError('TREND_GENERATION')`
- Unit tests: `trend-retry.util`, `trend-identity.util`

```
نوبت ۶ — trend-finder 

Workspace: /Users/artanzh/Desktop/token-platform
مرجع: docs/main-info.md §16

محدوده: src/modules/trend-finder/*

کار:
1. retry با backoff برای OpenAI و GMGN symbol check. ✅
2. خطا → CycleLog واضح در core-trigger trend step. ✅
3. TrendPackage persist کامل. ✅

 فقط retry + error messages.

Acceptance:
- build سبز ✅
- trend step بعد از rate limit recover می‌شود
```

---

## نوبت ۷ — market-generator

**وضعیت: ✅ تکمیل شده + hardened (۲۰۲۶-۰۶-۲۲)**

پیاده‌سازی:
- `TradeEngineService`: buy/sell on-chain از Pump/LetsBonk/FourMeme SDK
- On-chain verify: `hasConfirmedTransaction` / `hasSuccessfulTransaction` قبل از persist
- `assertWalletFunded` قبل از هر trade (forceRefresh از نوبت ۴)
- Trade DB: `txHash`, `network`, `side`, `gasFeeUsd`, `latencyMs` واقعی
- Redis wallet state — cooldown/max-trades survive worker restart
- Redis trade pending — idempotent persist بعد از crash
- `market-making.processor`: tick lock + exponential backoff requeue + CycleLog on failure
- Strategy از `settings.strategy` — `targetMarketCapUsd`, `buyBias`, `maxIgnitionDurationSeconds`
- Unit tests: `trade-engine.util`

```
نوبت ۷ — market-generator: trade on-chain و Blitz پایه. [تکمیل شد]

Workspace: /Users/artanzh/Desktop/token-platform
مرجع: docs/main-info.md §23.3 · §3.5

محدوده:
- src/modules/market-generator/*
- trade-engine.service.ts
- processors/market-making.processor.ts

کار:
1. TradeEngineService: buy/sell on-chain از launchpad SDK — حفظ و harden. ✅
2. حذف hardcode (مثلاً targetMarketCapUsd ثابت) → از settings.strategy. ✅
3. market-making.processor: self-requeue تا پایان ignition/session. ✅
4. Trade در DB: txHash واقعی، network، side — نه simulated gas/latency به‌عنوان تنها خروجی. ✅
5. قبل trade: wallet funded check (نوبت ۴). ✅

محدودیت:
- strategy-optimizer و visibility را wire نکن (نوبت ۸–۹). ✅

Acceptance:
- build سبز ✅
- session بعد از cycle → Trade rows با txHash
- حداقل چند trade در ۵ دقیقه اول (تست با ۵ ولت)
```

---

## نوبت ۸ — strategy-optimizer

**وضعیت: ✅ تکمیل شده + hardened (۲۰۲۶-۰۶-۲۲)**

پیاده‌سازی:
- `StrategyOptimizerService` → `MarketGeneratorService.runTick` هر tick
- `blitz-strategy.util` — phase detector، ignition controller، virality، blitz index (pure/testable)
- Thresholds از `settings.strategy` + root settings — بدون hardcode در objective score
- `shouldStopBlitzIgnition` — T+300s hard stop، PHASE_2_FOMO success، PHASE_3_MISS
- Ignition modes: NORMAL → ACCELERATE → FINAL_SPRINT → MISS
- Redis `market:strategy-state` — pause-sells + evaluation survive worker restart
- Strategy CycleLog: tpm از decision + base setpoint + blitzIndex + thresholds
- Unit tests: `blitz-strategy.util`

```
نوبت ۸ — strategy-optimizer را به market-generator wire کن (§19 Blitz). [تکمیل شد]

Workspace: /Users/artanzh/Desktop/token-platform
مرجع: docs/main-info.md §19 · §23.3

محدوده:
- src/modules/strategy-optimizer/*
- src/modules/market-generator/market-generator.service.ts (runTick)
- settings.strategy از settings.types

کار:
1. inject StrategyOptimizerService در MarketGeneratorService. ✅
2. هر tick: phase (ignition/organic)، targetTradesPerMinute، BlitzController از settings. ✅
3. maxIgnitionDurationSeconds=300 → hard stop ignition. ✅
4. اهداف: targetPriceChangePercent، minVolume5mUsd، minLiquidityRatio، minMarketCapUsd از settings. ✅

Acceptance:
- build سبز ✅
- log/session نشان می‌دهد trade rate از strategy می‌آید نه ثابت
- بعد 300s ignition متوقف می‌شود
```

---

## نوبت ۹ — visibility + token-info + liquidity (§20 Bot Magnet)

**وضعیت: ✅ تکمیل شده + hardened (۲۰۲۶-۰۶-۲۲)**

پیاده‌سازی:
- `VisibilityOrchestrator` → buy/sell bias + trade pacing + pause sells در `runTick`
- Phase timing از `dexScreenerPollSeconds` — ALPHA/BETA/GAMMA/DELTA
- `mergeMarketMetrics` — GMGN + DexScreener + token-info → `TokenMetricSnapshot`
- `liquidity-analyzer` → `LiquiditySnapshot` (pools با liquidity > 0)
- Snapshot throttle — `dexScreenerPollSeconds` interval (Redis `market:snapshot:last`)
- `token-info` — `REDIS_KEYS.tokenInfo` cache + `token-info.util`
- Visibility log — ALPHA/BETA/GAMMA/DELTA با buyBias در CycleLog
- Unit tests: `visibility-phase`, `market-metrics`, `token-info.util`

```
نوبت ۹ — visibility-orchestrator + token-info + liquidity-analyzer (§20).

Workspace: /Users/artanzh/Desktop/token-platform
مرجع: docs/main-info.md §20 · §3.7–3.8

محدوده:
- src/modules/visibility-orchestrator/*
- src/modules/token-info/*
- src/modules/liquidity-analyzer/*
- market-generator.service.ts · trade-engine.service.ts
- prisma TokenMetricSnapshot، LiquiditySnapshot

کار:
1. wire VisibilityOrchestrator → buy/sell bias و trade pacing در runTick. ✅
2. هر tick: token-info → TokenMetricSnapshot persist. ✅
3. liquidity-analyzer → LiquiditySnapshot persist. ✅
4. DexScreener + GMGN در visibility — از integrations موجود. ✅

Acceptance:
- build سبز ✅
- بعد session: TokenMetricSnapshot + LiquiditySnapshot در DB ✅
- buy bias در فازهای Alpha/Beta/Gamma قابل مشاهده در log ✅
```

---

## نوبت ۱۰ — profit-extractor (§18 سود واقعی) ✅

**وضعیت: ✅ تکمیل شده + hardened (۲۰۲۶-۰۶-۲۲)**

پیاده‌سازی:
- `profit-extract.util` — **creator cap** (`maxTokenHoldPercent` فقط TOKEN_OWNER) · **market TWAP** · floor `minMarketHoldPercent`
- `TokenSupplyService` — GMGN → pumpfun/fourmeme → fallback؛ `supplySource` واقعی در status
- `HoldingCalculatorService` — `ownerHeldPercent` · `marketHeldPercent` · split snapshot
- `ProfitSellExecutorService` — sell on-chain · modes `OWNER_TRIM` | `MARKET_TWAP`
- `capAppliesTo: 'TOKEN_OWNER'` در status API
- `ProfitExtractionLog` — txHash واقعی، usdRecovered، held% before/after
- `MainWalletLedger` IN — سود به Main Fee Wallet + `cycle.netProfitUsd` (idempotent per batch)
- Redis `profit:extract:lock` — جلوگیری از sell همزمان روی یک cycle
- Queue dedupe — `ALREADY_QUEUED` اگر job pending برای cycle وجود دارد
- `ProfitMarketGateService` — sellInRed، liquidity، sentiment gate
- Unit tests: `profit-extract.util`

```
نوبت ۱۰ — profit-extractor: فروش on-chain واقعی (§18). [تکمیل شد]

Workspace: /Users/artanzh/Desktop/token-platform
مرجع: docs/main-info.md §18 · §23.5

محدوده:
- src/modules/profit-extractor/*
- reuse مسیر sell از trade-engine / launchpad SDKs
- prisma ProfitExtractLog

کار:
1. held% از trades + supply واقعی (GMGN یا on-chain — نه hardcode 1e9). ✅
2. اگر held > cap (settings) → on-chain sell (TWAP یا batch از settings). ✅
3. ProfitExtractLog: txHash، usdRecovered واقعی. ✅
4. پول به سمت main fee / wallet owner طبق §18. ✅
5. on-chain tx verify قبل از persist trade/log. ✅
6. Redis lock + queue dedupe. ✅

Acceptance:
- build سبز ✅
- simulate حذف شده ✅
- held > 10% → sell واقعی + log ✅
- unit tests در test/unit/modules/profit-extractor ✅
```

---

## نوبت ۱۱ — emergency + telegram ✅

**وضعیت: ✅ تکمیل شده + hardened (۲۰۲۶-۰۶-۲۲)**

پیاده‌سازی:
- `EmergencyBrakeCoordinatorService` — pause 4 queues · Redis `system:operational:halt` · cancel pending jobs
- `emergency-brake.util` — status، USD recovery، min reserve، convertTo، sell retries
- `EmergencySellProcessor` — parallel sell 20 / sweep 10 · on-chain + tx verify
- `GET /emergency/halt` · `POST /emergency/resume`
- GLOBAL brake → full treasury drain via lifecycle queue
- `convertToUsdc` از request یا `treasury.consolidate.defaultConvertTo`
- `TelegramNotifyProcessor` — async delivery با 3 attempts + exponential backoff
- `TelegramLog` برای هر chat/event (delivered true/false)
- Core-trigger hooks: CYCLE_START، CYCLE_COMPLETE، CYCLE_FAILED
- Unit tests: `emergency-brake.util` + `telegram-message.util`

```
نوبت ۱۱ — emergency + telegram production. [تکمیل شد]

Workspace: /Users/artanzh/Desktop/token-platform
مرجع: docs/main-info.md §17 · §3.10 · §23.4

محدوده:
- src/modules/emergency/*
- src/modules/telegram/*
- src/common/queue — QUEUE_TELEGRAM_NOTIFY processor جدید
- core-trigger hooks برای cycle events

کار:
1. EmergencySweepProcessor: sweep on-chain (نه stub). ✅
2. emergency sell GLOBAL: همه توکن‌ها sellAll. ✅
3. convertToUsdc اگر در settings تعریف شده wire شود. ✅
4. TelegramNotifyProcessor + ارسال: CYCLE_START، CYCLE_COMPLETE، CYCLE_FAILED، EMERGENCY_BRAKE، PROFIT_EXTRACT. ✅
5. TelegramLog برای هر event. ✅
6. on-chain tx verify + sell retry + market queue resume بعد از unlock. ✅

Acceptance:
- build سبز ✅
- POST /emergency/brake → فروش واقعی + TG message ✅
- cycle → حداقل start + complete/fail در TG ✅
- unit tests در test/unit/modules/emergency ✅
```

---

## نوبت ۱۲ — treasury (§22 recycle) ✅

**وضعیت: ✅ تکمیل شده + hardened (۲۰۲۶-۰۶-۲۲)**

پیاده‌سازی:
- `treasury-consolidate.util` — status، totals، min reserve، concurrent map (pure/testable)
- `treasury-lifecycle.util` — parse configs، deposit wait، timeout/deadline
- `ConsolidateExecutorService` — sellAll on-chain + tx verify RPC + 3× retry
- `ConsolidateTransferProcessor` — Redis lock + pause/resume market queue + PARTIAL detection
- `TreasuryDrainRunnerService` — delegat به consolidator (on-chain واقعی) + lifecycle wallet states
- `TreasuryRearmRunnerService` — poll balance واقعی main fee + wallet pool FRESH/REUSE/AUTO + funding
- `LifecycleDrainProcessor` / `LifecycleRearmProcessor` — orchestrated drain → wait → rearm
- Redis `treasury:consolidate:lock` + `treasury:lifecycle:lock:{jobId}`
- Queue dedupe — conflict اگر consolidate/lifecycle فعال باشد
- Settings: `treasury.consolidate` slippage/minSweep + lifecycle deposit poll
- Unit tests: `treasury.util`

```
نوبت ۱۲ — treasury-consolidator + treasury-lifecycle (§22). [تکمیل شد]

Workspace: /Users/artanzh/Desktop/token-platform
مرجع: docs/main-info.md §21–§22 · §23.6

محدوده:
- src/modules/treasury-consolidator/*
- src/modules/treasury-lifecycle/*
- integrations RPC + launchpad sell patterns از emergency/profit

کار:
1. ConsolidateSellProcessor / ConsolidateSweepProcessor / ConsolidateTransferProcessor — on-chain واقعی. ✅
2. LifecycleDrainProcessor → delegat به consolidator (نه فقط صفر DB). ✅
3. WAITING_DEPOSIT: poll balance واقعی main fee. ✅
4. LifecycleRearmProcessor: ولت جدید + funding + اختیاری startCycle. ✅
5. POST /treasury/lifecycle/run end-to-end. ✅
6. Redis lock + market pause/resume + tx verify + sell retry. ✅

Acceptance:
- build سبز ✅
- lifecycle/run کامل drain → wait → rearm ✅
- unit tests در test/unit/modules/treasury ✅
```

---

## پرامپت تست یکپارچه (فاز B)

```
تست فاز B — اولین cycle live (۵ wallet).

Settings (PATCH):
- marketWalletCount: 5 · maxInvestmentUsd: 500 · minTradeAmountUsd: 2
- networkPriority: ["SOLANA"] · sellInRed: false

Pre-flight: docs/implementation-roadmap.md فاز A
- Main Fee: USDC@ETH + ETH@ETH (≥$150 buffer)
- start:api + start:worker · health سبز

کار:
1. POST /core-trigger/cycles
2. FundingTransaction COMPLETED · Token txHash · SecurityReport ≥70
3. Trade با txHash · GET /profit-extractor/status/{cycleId}
```

---

## پرامپت production (فاز C — $5K · 200w)

```
تست production — scale v3 profile.

مرجع: implementation-roadmap.md فاز C · cost-model.md · settings.defaults.json

PATCH settings:
- marketWalletCount: 200 · maxInvestmentUsd: 5000 · minTradeAmountUsd: 2
- strategy.targetTradesPerMinute: 150 · buyBiasPercent: 70
- maxTokenHoldPercent: 10 · strategy.profitExtract.minMarketHoldPercent: 20
- strategy.profitExtract.sellInRed: false
- treasury.lifecycle.minRearmBalanceUsd: 5000

Main Fee (~$5K): $3,250 USDC@ETH + $200 ETH@ETH (ChangeNOW deposit gas)

کار:
1. POST /core-trigger/cycles — monitor greenCount (هدف 12/12)
2. GET /profit-extractor/status/{cycleId}
3. C_op burn انتظار ~$280–380 (cost-model)
4. بعد ۵–۱۰ چرخه: POST /treasury/lifecycle/run DRAIN

Acceptance: COMPLETED · Signal ≥10 GREEN · TWAP یا bot inflow
```

