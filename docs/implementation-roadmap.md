# نقشه راه اجرایی — Production Go-Live & سود حداکثری

> **نسخه:** 3.0 — کد ۱۲/۱۲ ماژول ✅ · تمرکز روی **راه‌اندازی live** و **عملیات بدون استرس**  
> **مراجع:** [`main-info.md`](./main-info.md) §23–§25 · [`cost-model.md`](./cost-model.md) v3.0 · [`settings.defaults.json`](./settings.defaults.json)  
> **تست:** `119 passed` · `npm run build` سبز

### مستندات اکوسیستم — همه با هم

| سند | کی بخواند | محتوا |
|-----|-----------|--------|
| **[`production-test-plan.md`](./production-test-plan.md)** | **قبل از go-live** | **چک‌لیست ۰–۱۰۰٪ · API به API · provider به provider · ~۱۰۵ تست** |
| **این فایل** | اپراتور · go-live | فاز A–D · verify · troubleshooting |
| [`cost-model.md`](./cost-model.md) | قبل از واریز پول | $5K/$10K · ChangeNOW fee/gas · burn واقعی |
| [`external-integrations.md`](./external-integrations.md) | setup keys | §0 credentials · ChangeNOW §3.4 · health |
| [`admin-panel-spec.md`](./admin-panel-spec.md) | تیم Frontend | پنل ادمین · فلو صفحات · API Key gate |
| [`cursor-stage-prompts.md`](./cursor-stage-prompts.md) | Agent copy-paste | پرامپت فاز A–D · debug · آرشیو BUILD |

---

## یک جمله: الان کجا ایستادی؟

**کد production-hardened است — دیگر نوبت «ساخت ماژول» نیست.**  
نوبت **اپراتور:** کلیدهای live · Main Fee · worker · اولین چرخه تست · scale به $5K · مانیتور TWAP/bot cascade.

```
[✅] ۱۲ ماژول wired · on-chain · poll · ledger
[✅] budget guard · emergency halt · creator 10% cap · market TWAP floor
[⏳] تو: keys + $5K Main Fee + worker + اولین cycle live
```

---

## مسیر سود — از سرمایه تا lock

```
Main Fee (USDC@ETH 65% + ETH@ETH 25% + اختیاری USDC@SOL 10%)
    │
    ├─► Cron / POST /core-trigger/cycles
    ├─► Trend (OpenAI + GMGN) → Security gate ≥70
    ├─► ChangeNOW ×201 wallet (parallel 20) — fee ~0.5% + ETH gas ~$80–350
    ├─► Launch (Pump.fun / LetsBonk / FourMeme) + Jito bundle
    ├─► Blitz 4.5min · 150 tpm · 200 wallet → Signal Bundle 12/12 GREEN
    │       └─► Bot cascade (مکانیکی اگر spec بخورد)
    ├─► Profit Extract: creator ≤10% · market TWAP در سبز · floor 20%
    └─► Drain/Rearm هر ۵–۱۰ چرخه → سرمایه recycle
```

| اگر این خراب باشد | نتیجه |
|-------------------|--------|
| ETH کم برای ChangeNOW deposit | funding `FAILED` · چرخه صفر |
| Worker خاموش | queue hang · صفر trade |
| `maxInvestmentUsd` بدون buffer ETH | budget OK ولی gas fail |
| ترمز دستی روزمره | فرصت bot cascade از دست می‌رود |
| `sellInRed: true` | فروش در ضرر — **هرگز** |

---

## وضعیت ماژول‌ها — همه ✅

| # | ماژول | وضعیت | نقش در سود |
|---|--------|--------|------------|
| ۰ | `integrations` + `settings` + `common` | ✅ | RPC · ChangeNOW · GMGN · types |
| ۱ | `main-fee-wallet` | ✅ | funding poll · ledger · balance chain |
| ۲ | `core-trigger` + `funding-gate` | ✅ | await COMPLETED · cron از settings · **budget guard** |
| ۳ | `security-check` | ✅ | GMGN gate قبل از funding · SecurityReport |
| ۴ | `wallet-generator` | ✅ | balance RPC · pre-trade check |
| ۵ | `token-factory` | ✅ | launch on-chain · lock · crash recovery |
| ۶ | `trend-finder` | ✅ | OpenAI + GMGN retry · TrendPackage |
| ۷ | `market-generator` | ✅ | TradeEngine on-chain · Blitz ignition |
| ۸ | `strategy-optimizer` | ✅ | BlitzController · dynamic tpm |
| ۹ | `visibility-orchestrator` + metrics | ✅ | Signal Bundle · Bot Magnet · snapshots |
| ۱۰ | `profit-extractor` | ✅ | on-chain sell · **creator cap** · **market TWAP** |
| ۱۱ | `emergency` + `telegram` | ✅ | **system halt** · parallel sell/sweep · TG |
| ۱۲ | `treasury-lifecycle` | ✅ | drain · rearm · `minRearmBalanceUsd` |

### لایه‌های hardening v3 (اضافه بر ۱۲ ماژول)

| لایه | فایل | اثر |
|------|------|-----|
| **Cycle budget** | `cycle-budget.util.ts` | funding ≤85% `maxInvestmentUsd` · runtime stop |
| **Emergency coordinator** | `emergency-brake-coordinator.service.ts` | pause 4 queue · Redis halt · cancel jobs |
| **System halt** | `system-halt.util.ts` | block `startCycle` تا `POST /emergency/resume` |
| **Profit split** | `profit-extract.util.ts` | `maxTokenHoldPercent` فقط creator · market floor 20% |
| **GLOBAL drain** | `treasury-drain-runner.service.ts` | brake → full sweep به Main Fee |

---

## ⬇️ نوبت کار اپراتور — از بالا به پایین

**قانون:** فاز N تا ✅ نشود، فاز N+1 را شروع نکن.

| فاز | هدف | زمان | وضعیت |
|-----|------|------|--------|
| **A** | Pre-flight — keys · health · Main Fee | روز ۱ | ⏳ اپراتور |
| **B** | چرخه تست — ۵ wallet · dry-run off | روز ۲–۳ | ⏳ |
| **C** | Scale production — 200w · $5K | روز ۴–۵ | ⏳ |
| **D** | اتوماسیون کامل — cron · drain · TG | هفته ۲+ | ⏳ |

---

## فاز A — Pre-flight (قبل از اولین پول)

### A.1 کلیدها و env

| مورد | setting / env | چک |
|------|---------------|-----|
| API Key | `.env` → `API_KEY` | REST auth |
| OpenAI | `integrations.openaiApiKey` | trend + logo |
| GMGN | `integrations.gmgnApiKey` | security · swap · metrics |
| ChangeNOW | `integrations.changeNowApiKey` | funding |
| PumpPortal | `integrations.pumpPortalApiKey` | Solana trades |
| QuickNode SOL | `integrations.solanaRpcUrl` | 150 tpm |
| QuickNode ETH | `integrations.ethereumRpcUrl` | **ChangeNOW USDC deposit** |
| QuickNode BSC | `integrations.evmRpcUrl` | FourMeme |
| Main Fee key | `integrations.mainFeeWalletEvmPrivateKey` | باید match `GET /main-fee-wallet` |
| Telegram | `telegram.botToken` + `chatIds` | alerts |

```bash
npm run build
npm test                    # 119 passed
npm run start:api           # terminal 1
npm run start:worker        # terminal 2 — اجباری
```

### A.2 Health — همه سبز

```http
GET /health
GET /integrations/health
GET /integrations/rpc/health
```

| سرویس | باید |
|--------|------|
| `gmgn` | `up` |
| `changenow` | `up` |
| `openai` | `up` |
| `solana` / `ethereum` / `bsc` RPC | `up` · latency < 500ms |

### A.3 Main Fee — ترکیب درست (از cost-model v3)

| دارایی | % | مقدار @ $5K | چرا |
|--------|---|-------------|-----|
| USDC | Ethereum | 65% | ~$3,250 | منبع ChangeNOW |
| ETH | Ethereum | 25% | ~$150–200 | **۲۰۱ deposit gas** — بدون این funding fail |
| USDC | Solana | 10% | ~$500 | اختیاری · bypass |

```http
GET /main-fee-wallet
```

- `totalUsd ≥ 5000` برای production
- `bscAddress` = آدرس مشتق‌شده از `mainFeeWalletEvmPrivateKey`

### A.4 Settings — PATCH live (نه فقط defaults.json)

اگر DB از قبل seed شده، **حتماً PATCH:**

```http
PATCH /settings
```

| key | production | test |
|-----|------------|------|
| `maxInvestmentUsd` | **5000** | 500–1000 |
| `marketWalletCount` | **200** | **5** |
| `minTradeAmountUsd` | **2** | 1 |
| `strategy.targetTradesPerMinute` | **150** | 30 |
| `strategy.profitExtract.minMarketHoldPercent` | **20** | 20 |
| `strategy.profitExtract.sellInRed` | **false** | false |
| `maxTokenHoldPercent` | **10** | 10 |
| `treasury.lifecycle.minRearmBalanceUsd` | **5000** | 500 |
| `cronExpression` | `0 */4 * * *` | `0 */8 * * *` |

### ✅ فاز A تمام شد وقتی

- [ ] `npm run build` + `npm test` سبز
- [ ] API + **worker** هر دو روشن
- [ ] `/integrations/health` — blockers سبز
- [ ] Main Fee ≥ هدف tier · **ETH buffer ≥ $150**
- [ ] Settings PATCH شده (نه فقط `defaults.json`)
- [ ] Telegram تست پیام دریافت شد

---

## فاز B — اولین چرخه live (۵ wallet)

**هدف:** verify end-to-end بدون سوزاندن $5K.

### B.1 Settings تست

```
marketWalletCount: 5
maxInvestmentUsd: 500
networkPriority: ["SOLANA"]
dryRun: false
```

### B.2 Trigger

```http
POST /core-trigger/cycles
```

یا منتظر cron بمان.

### B.3 مانیتور — state machine

| state | انتظار | timeout |
|-------|--------|---------|
| `TREND_GENERATION` | TrendPackage در DB | ~2 min |
| `SECURITY_CHECK` | SecurityReport score ≥70 | ~1 min |
| `FUNDING` | همه `FundingTransaction` → `COMPLETED` | ~5–15 min |
| `TOKEN_LAUNCH` | mint + txHash | ~2 min |
| `MARKET_MAKING` | Trade rows با txHash | 4.5 min |
| `COMPLETED` | cycle done | — |

```http
GET /cycles/{id}
GET /cycles/{id}/logs
```

### B.4 Verify در DB / chain

| Model | چک |
|-------|-----|
| `FundingTransaction` | 6 ردیف (1 owner + 5 market) · همه `COMPLETED` |
| `Trade` | `txHash` ≠ null · `latencyMs` > 0 |
| `TokenMetricSnapshot` | بعد از session · volume/mc |
| `SecurityReport` | `isSafe: true` |

### B.5 Verify سود (حتی در تست کوچک)

```http
GET /profit-extractor/status/{cycleId}
```

- `capAppliesTo: "TOKEN_OWNER"`
- `ownerHeldPercent` ≤ 10 (یا OWNER_TRIM scheduled)
- `marketHeldPercent` ≥ floor تا TWAP فعال بماند

### ✅ فاز B تمام شد وقتی

- [ ] یک چرخه `COMPLETED` بدون `FAILED`
- [ ] توکن روی pump.fun / Solscan visible
- [ ] ≥10 trade با txHash واقعی
- [ ] Telegram: `CYCLE_COMPLETE`
- [ ] هیچ `FundingTransaction` با `below ChangeNOW minimum`

**اگر fail:** بخش Troubleshooting پایین.

---

## فاز C — Scale به production ($5K · 200 wallet)

### C.1 Settings production

از [`settings.defaults.json`](./settings.defaults.json) یا جدول فاز A.4.

### C.2 هزینه واقعی (از cost-model)

| burn per cycle | typical |
|----------------|---------|
| ChangeNOW fee | ~$5 |
| ETH gas (۲۰۱ deposit) | ~$150 |
| Blitz Solana gas | ~$120 |
| **کل C_op burn** | **~$280–380** |

USDC اصل (~$455) **می‌چرخد** — via drain/TWAP برمی‌گردد.

### C.3 Bot Magnet — هدف هر چرخه

| signal | threshold v3 |
|--------|--------------|
| Vol 5m | ≥ $100K |
| ΔP | ≥ +500% |
| unique wallets | ≥ 100 |
| tx 5m | ≥ 300 |
| Signal Bundle | **12/12 GREEN** |

```http
GET /cycles/{id}   # visibility phase · greenCount در logs
```

### C.4 Budget guard — خودکار

```
Upfront: 201 × ~$2.3 ≈ $463 ≤ 0.85 × $5000 = $4250  ✅
Runtime: funding + gas ≥ maxInvestmentUsd → market session STOP
```

نیازی به دخالت دستی نیست — فقط `maxInvestmentUsd` را درست set کن.

### ✅ فاز C تمام شد وقتی

- [ ] چرخه full 200w `COMPLETED`
- [ ] Signal Bundle ≥10/12 GREEN (هدف 12/12)
- [ ] `botMagnetActive` در logs/TG
- [ ] TWAP یا OWNER_TRIM اجرا شده (اگر قیمت سبز)
- [ ] `netProfitUsd` on cycle ≥ 0 یا درflow قابل توجه

---

## فاز D — اتوماسیون کامل · خیال راحت

### D.1 Cron خودکار

```
cronExpression: "0 */4 * * *"   # هر ۴ ساعت
```

Core trigger scheduler از settings می‌خواند — hardcode نیست.

### D.2 Drain دوره‌ای

```http
POST /treasury/lifecycle/run
{ "mode": "DRAIN", "convertTo": "NATIVE" }
```

| frequency | چرا |
|-----------|-----|
| هر **۵–۱۰ چرخه** | recycle SOL → Main Fee |
| بعد از چرخه بزرگ موفق | lock قبل از dump |

`minRearmBalanceUsd: 5000` — زیر این rearm block.

### D.3 Emergency — فقط panic

```http
POST /emergency/brake
{ "scope": "GLOBAL", "convertTo": "NATIVE" }
```

| انجام می‌دهد | انجام نمی‌دهد |
|--------------|---------------|
| pause 4 queue | جایگزین TWAP روزمره |
| Redis `system:operational:halt` | |
| sell all + sweep → Main Fee | |

```http
GET /emergency/halt
POST /emergency/resume    # فقط بعد از بررسی دستی
```

### D.4 مانیتور روزانه (۵ دقیقه)

| چک | endpoint / action |
|----|-------------------|
| Worker alive | process · queue depth |
| Main Fee USD | `GET /main-fee-wallet` |
| آخرین cycle | `GET /cycles?limit=5` |
| Funding fails | DB `FundingTransaction.failureReason` |
| Halt flag | `GET /emergency/halt` |
| TG alerts | هر `CYCLE_FAILED` = investigate |

### ✅ فاز D تمام شد وقتی

- [ ] ۷ روز cron بدون worker crash
- [ ] drain خودکار یا scheduled اجرا شده
- [ ] ≥1 چرخه با bot cascade / inflow مثبت
- [ ] emergency تست شده یک‌بار روی testnet/small cycle
- [ ] `sellInRed` هنوز `false` است

---

## جدول تأیید per ماژول (مرجع عمیق)

<details>
<summary>گام ۱ — main-fee-wallet ✅</summary>

- `changenow-funding.service.ts` — poll تا `finished` · `getMinAmountV2` validate
- `funding.processor.ts` — batch concurrency 20 · ledger debit
- `main-fee-wallet.service.ts` — balance from chain

**Verify:** `FundingTransaction.COMPLETED` · `MainWalletLedger` debit · ETH کافی برای deposit

</details>

<details>
<summary>گام ۲ — core-trigger + funding gate ✅</summary>

- `funding-gate.service.ts` — `pollUntilSettled`
- `core-trigger.service.ts` — `validateFundingBudget` قبل از queue
- `core-trigger.scheduler.ts` — cron از settings

**Verify:** cycle در `FUNDING` می‌ماند تا settle · fail → `FAILED`

</details>

<details>
<summary>گام ۳ — security-check ✅</summary>

- `security-check.processor.ts` → `SecurityCheckService`
- `SecurityReport` در DB · abort اگر score < 70

</details>

<details>
<summary>گام ۴–۵ — wallet + token-factory ✅</summary>

- `assertWalletFunded` · `computeOwnerLaunchFundingUsd`
- Launch lock Redis · on-chain confirm · launchpad selector

</details>

<details>
<summary>گام ۶–۹ — trend · market · strategy · visibility ✅</summary>

- `TradeEngineService` on-chain · self-requeue ignition
- `StrategyOptimizerService` در `runTick`
- `VisibilityOrchestrator` · `SignalBundleService` 12 signals
- `TokenMetricSnapshot` + `LiquiditySnapshot` هر tick

</details>

<details>
<summary>گام ۱۰ — profit-extractor ✅</summary>

- `OWNER_TRIM` — creator > 10%
- `MARKET_TWAP` — market wallets · فقط سبز · floor 20%
- `ProfitSellExecutorService` on-chain · ledger IN

```http
GET /profit-extractor/status/{cycleId}
```

</details>

<details>
<summary>گام ۱۱ — emergency + telegram ✅</summary>

- `EmergencyBrakeCoordinatorService` — halt + queue pause
- Parallel sell 20 / sweep 10
- `TelegramNotifyProcessor` — cycle · emergency · profit

</details>

<details>
<summary>گام ۱۲ — treasury-lifecycle ✅</summary>

- `POST /treasury/lifecycle/run` — DRAIN · REARM
- `treasury-drain-runner.service.ts` — inventory sweep
- `autoPauseCyclesOnDrain` · `minRearmBalanceUsd`

</details>

---

## Troubleshooting — سریع

| symptom | علت محتمل | fix |
|---------|-----------|-----|
| `below ChangeNOW minimum` | min لحظه‌ای > `amountPerWalletUsd` | صبر · یا `minTradeAmountUsd` بالا · retry |
| ChangeNOW `waiting`/`expired` | ETH کم · USDC کم · deposit fail | شارژ ETH@ETH · check `depositTxHash` |
| cycle stuck `FUNDING` | worker down | `npm run start:worker` |
| trade بدون txHash | dry-run · RPC down | `dryRun: false` · RPC health |
| bundle < 8 GREEN | wallet کم · tpm پایین | scale به 200w · 150 tpm |
| `system:operational:halt` | emergency brake | `GET /emergency/halt` → `POST /resume` |
| rearm block | Main Fee < `minRearmBalanceUsd` | drain · TWAP · واریز |
| C_op exceeded | budget guard fired | normal · یا `maxInvestmentUsd` بالا |

---

## سه tier سرمایه — کدام فاز؟

| tier | Main Fee | فاز roadmap | هدف |
|------|----------|-------------|-----|
| تست | $800–1K | B | یادگیری · 5–100 wallet |
| **جدی** | **$5K** | **C** | Blitz full · bot magnet |
| راحت | $10K | C + D | buffer ~15 چرخه |

جزئیات مالی: [`cost-model.md`](./cost-model.md)

---

## پرامپت‌های Agent (فقط اگر gap جدید پیدا شد)

> کد کامل است — این پرامپت‌ها برای **باگ یا feature جدید** است، نه build اولیه.

| سناریو | به Agent بگو |
|--------|--------------|
| funding fail مکرر | «ChangeNOW minimum و ETH deposit gas را debug کن — `FundingTransaction.failureReason`» |
| bundle never GREEN | «Visibility + Blitz tpm را با 200 wallet profile tune کن» |
| profit not locking | «`GET /profit-extractor/status` — MARKET_TWAP gate و sellInRed» |
| بعد از brake | «`GET /emergency/halt` — چرا resume safe است» |

پرامپت‌های تاریخی build: [`cursor-stage-prompts.md`](./cursor-stage-prompts.md)

---

## چه چیز را لمس نکن

| مسیر | چرا |
|------|-----|
| `src/integrations` | stable — فقط اگر health قرمز |
| `sellInRed: true` | ضرر تضمینی |
| emergency روزمره | bot cascade را می‌کشد |
| `marketWalletCount: 5` در production | spec نمی‌خورد |
| commit `.env` / private keys | امنیت |

---

## وضعیت یک نگاه

```
BUILD (۱۲ گام)     ████████████████████  100%  ✅
HARDENING v3       ████████████████████  100%  ✅
GO-LIVE فاز A      ░░░░░░░░░░░░░░░░░░░░    0%  ← شروع تو
GO-LIVE فاز B–D    ░░░░░░░░░░░░░░░░░░░░    0%
```

---

## قدم بعدی — همین الان

1. `npm run start:api` + `npm run start:worker`
2. PATCH settings (جدول فاز A.4)
3. شارژ Main Fee: **$3.25K USDC + $200 ETH** روی Ethereum
4. `GET /integrations/health` — همه سبز
5. فاز B: `marketWalletCount: 5` · یک cycle
6. فاز C: scale به 200w · $5K · cron روشن

**سود حداکثری = فاز C با spec کامل + فاز D drain/TWAP خودکار — نه کد بیشتر.**

**ترتیب خواندن:** `external-integrations.md` §0 (keys) → `cost-model.md` (پول) → این فایل فاز A → `cursor-stage-prompts.md` (Agent)

---

*v3.0 — Implementation complete · [`cost-model.md`](./cost-model.md) · [`external-integrations.md`](./external-integrations.md) · [`cursor-stage-prompts.md`](./cursor-stage-prompts.md)*
