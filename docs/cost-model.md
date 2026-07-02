# چقدر پول لازم است؟ — مدل هزینه و سود (Production)

> **برای کی:** اپراتور — «چقدر بریزم؟ چقدر می‌سوزد؟ چطور سود maximize کنم؟»  
> **نسخه:** 3.0 (هم‌تراز با `settings.defaults.json` + budget guard + creator 10% cap)  
> **جزئیات فنی:** `main-info.md` §18–§19 · §23 · §25  
> **تنظیمات:** `docs/settings.defaults.json`

### مستندات مرتبط

| سند | نقش |
|-----|-----|
| [`implementation-roadmap.md`](./implementation-roadmap.md) | **فاز A–D go-live** — قدم‌به‌قدم عملیاتی |
| [`external-integrations.md`](./external-integrations.md) | API keys · ChangeNOW §3.4 · health runbook |
| [`cursor-stage-prompts.md`](./cursor-stage-prompts.md) | پرامپت Agent برای هر فاز |

---

## جواب یک خطی

| هدف | Main Fee Wallet | `maxInvestmentUsd` |
|-----|-----------------|----------------------|
| تست — ۱–۳ چرخه، ۱۰۰ wallet | **$800 – $1,000** | $500 – $1,000 |
| **کار جدی — Blitz کامل، bot magnet** | **$5,000** | **$5,000** |
| production راحت — چند چرخه هم‌پوشان، buffer | **$10,000** | $5,000 |

**سود تضمینی نیست.** این اعداد برای **اجرای کامل اتوماسیون** است. upside از organic inflow + profit extract می‌آید — نه از تضمین سیستم.

---

## مدل سود (صادقانه + حداکثر upside)

```
E[سود خالص] = E[ورودی organic + bot] + E[Profit TWAP از market] − C_op − E[gas خروج]

C_op ≤ maxInvestmentUsd   ← enforce شده در کد (funding + gas + trades)
```

| منبع سود | چطور | تضمین؟ |
|----------|------|--------|
| **Bot / organic inflow** | Blitz گردش را بالا می‌برد → **Signal Bundle 12/12 GREEN** → ربات‌ها خودکار می‌خرند | ⚙️ **مکانیکی** اگر spec بخورد؛ ❌ هر چرخه ۱۰۰٪ spec نمی‌خورد |
| **Market TWAP** | فروش batch کوچک فقط در سبز → Main Fee | ✅ اتوماتیک (اگر قیمت بالا باشد) |
| **Creator trim** | فقط اگر owner > 10% supply | ✅ اتوماتیک |
| **Drain / rearm** | بازگرداندن سرمایه چرخشی | ✅ اتوماتیک |

### زنجیره Bot Magnet — چرا ربات‌ها «خودشان» می‌آیند

ربات‌ها احساس نمی‌کنند؛ **فیلتر می‌خوانند**. وقتی متریک‌ها از آستانه رد شوند، خرید خودکار trigger می‌شود — نه به خاطر ترند نام، بلکه به خاطر **عدد روی چارت**.

```
Blitz (150 tpm · 200 wallet · $2 min trade)
    ↓
Vol 5m ↑ · MC ↑ · LP ↑ · 100+ wallet · 300+ tx
    ↓
DexScreener / GMGN index می‌کنند (poll هر 10s)
    ↓
Signal Bundle S1–S12 → همه GREEN
    ↓
botMagnetActive + cascade confidence ≥ 0.7
    ↓
Sniper / copy-trade / GMGN bots → BUY cascade
    ↓
N_org ↑ → LP↑ MC↑ → جدول سود / TWAP lock
```

| آستانه (پیش‌فرض v3) | هدف Blitz | bot چه می‌بیند |
|---------------------|-----------|----------------|
| `Vol_5m ≥ $100K` | CASCADE sprint | trending / volume filter ✅ |
| `ΔP ≥ +500%` | ignition 4.5min | momentum filter ✅ |
| `unique_wallets ≥ 100` | anti-wash spread | wash-detector pass ✅ |
| `tx_count ≥ 300` | 150 tpm | activity filter ✅ |
| `LP ratio ≥ 0.95` | buy bias 70% | liquidity filter ✅ |
| `security ≥ 70` | gate قبل از funding | GMGN trust ✅ |
| `holder_count ≥ 60` | 200 market wallet | distribution pass ✅ |

**نتیجه:** اگر گردش به این جدول برسد، inflow bot **اثر جانبی طراحی‌شده** است — سیستم برای همین ساخته شده. آنچه تضمین نیست: **هر چرخه** به spec برسد (RPC، launchpad شلوغ، ترند ضعیف).

**حداکثر upside:** Full hit (+500%، $100K vol، bundle GREEN) → bot cascade → inflow اغلب **چند برابر** C_op (~$280–380 burn واقعی) — سپس TWAP سود را lock می‌کند.

---

## پول کجا می‌رود؟ (یک چرخه)

```
Main Fee Wallet (USDC@Ethereum + ETH + اختیاری USDC@Solana)
    │
    ├─► AI trend + logo                         ~$0.05 – $0.15
    ├─► Token launch (gas)                      ~$2 – $5
    ├─► Funding 201 wallet via ChangeNOW        ~$455 USDC اصل (می‌چرخد → SOL)
    │       ├─ ChangeNOW fee (~0.25–1%/swap)    ~$2 – $8   ← می‌سوزد
    │       └─ ETH gas (۲۰۱ transfer USDC)     ~$80 – $350 ← می‌سوزد
    ├─► Blitz 4.5min (~675 trades @150tpm)      ~$60 – $200 (Solana gas + slippage)
    ├─► Visibility polling (Dex/GMGN)           ~$0
    └─► Profit extract TWAP                     returns SOL → Main Fee
```

### دو نوع پول

| نوع | معنی | برمی‌گردد؟ |
|-----|------|------------|
| **می‌سوزد (C_op burn)** | gas اتریوم (ChangeNOW deposit)، fee ChangeNOW، AI، slippage، Solana trade fees | ❌ |
| **می‌چرخد** | USDC→SOL داخل walletها + توکن در market/creator | ✅ via drain / TWAP |

**سقف هر چرخه:** `maxInvestmentUsd: 5000` — سیستم **خودکار stop** می‌کند اگر funding+gas از این رد شود.

---

## ChangeNOW — فی، حداقل، و هزینهٔ پنهان

هر wallet = **یک سفارش جدا** ChangeNOW (`fundBatch` · concurrency 20). USDC از **Ethereum mainnet** به `payinAddress` فرستاده می‌شود → SOL/BNB به wallet مقصد.

### فی ChangeNOW

| مورد | مقدار | توضیح |
|------|-------|--------|
| **کارمزد swap** | ~**0.25% – 1%** هر سفارش | داخل نرخ — جدا invoice نمی‌شود |
| **typical** | ~**0.5%** | روی `fromAmount` USDC |
| **کل چرخه (۲۰۱ سفارش)** | ~**$2 – $8** | ۲۰۱ × ~$2.3 USDC × 0.5% |

### حداقل تبدیل (minimum) — مهم

ChangeNOW **حداقل ثابت ندارد** — per pair و **لحظه‌ای** از API می‌آید:

| pair | typical min | بازه واقعی |
|------|-------------|------------|
| USDC@ETH → SOL | ~**$2** | **$1.7 – $20** |
| USDC@ETH → BNB | ~**$3 – $5** | **$1.7 – $20** |
| ETH@ETH → SOL/BNB | متغیر | معمولاً بالاتر از USDC |

**کد ما validate می‌کند** (`getMinAmountV2`):

```
اگر amountPerWalletUsd < minAmount → FundingTransaction FAILED
پیام: "Amount X is below ChangeNOW minimum Y for usdc→sol"
```

| setting | مقدار v3 | ریسک |
|---------|----------|------|
| `minTradeAmountUsd` | **$2** | عمداً نزدیک کف ChangeNOW |
| `amountPerWalletUsd` واقعی (Solana) | ~**$2.2 – $2.5** | `max(minTrade, devBuy+priority+rent)` |

> اگر min لحظه‌ای بالا برود (شلوغی شبکه) → funding fail · چرخه `FAILED`.  
> **قبل از چرخه:** `GET /integrations/health` · لاگ `FundingTransaction.failureReason`

### ETH gas — هزینهٔ بزرگ پنهان

هر سفارش ChangeNOW = **۱ transfer USDC ERC20** روی Ethereum:

| | محاسبه |
|--|--------|
| سفارش‌ها | **۲۰۱** (owner + 200 market) |
| gas هر transfer | ~$0.40 – $2.50 (بسته به gwei) |
| **کل burn ETH** | ~**$80 – $350** typical · تا **$500+** در peak gas |

**پس Main Fee فقط USDC کافی نیست — ETH برای deposit gas لازم است:**

| buffer پیشنهادی | چرا |
|-----------------|-----|
| **$100 – $200 ETH** روی Ethereum | ۲۰۱ deposit + margin |
| **+ 10% USDC اضافه** | fee ChangeNOW + rounding |

### جمع‌بندی funding یک چرخه (Solana)

| line | USD | می‌سوزد؟ |
|------|-----|----------|
| اصل USDC→SOL (۲۰۱ wallet × ~$2.3) | ~$455 | ❌ می‌چرخد |
| ChangeNOW fee (~0.5%) | ~$2 – $8 | ✅ |
| ETH gas (۲۰۱ deposit) | ~$80 – $350 | ✅ |
| **burn فقط funding** | **~$85 – $360** | — |

---

## مدل توکن — چرا organic به نظر می‌رسد ولی control دست ماست

| wallet | سقف / نقش | scanner چه می‌بیند |
|--------|-----------|-------------------|
| **TOKEN_OWNER (creator)** | **≤ 10% supply** (`maxTokenHoldPercent`) | dev wallet کوچک — بدون red flag |
| **~200 MARKET wallet** | **اکثر توکن ما** — هر کدام % کوچک | holderهای پراکنده = organic |
| **Main Fee** | SOL/BNB/USDC — **نه توکن launch** | — |

```
Creator:  8%   ← visible cap
Market:  25%   ← position بزرگ، پخش‌شده
────────────────
کل ما:   33%   ← control غیرمستقیم
بقیه:    67%   ← buyers + bots
```

**Profit extract:**
- owner > 10% → فقط از **creator** trim
- market TWAP → فقط در **سبز**، batch 10%، **زیر floor 20% supply متوقف**

---

## پیش‌فرض v3 (Production $5K)

| Setting | مقدار | اثر |
|---------|-------|-----|
| `maxInvestmentUsd` | **5000** | سقف سخت هر چرخه |
| `marketWalletCount` | **200** | holder spread + volume |
| `targetTradesPerMinute` | **150** | ~675 trade در Blitz |
| `minTradeAmountUsd` | **2** | volume قوی‌تر روی چارت |
| `buyBiasPercent` | **70** | فشار خرید |
| `maxTokenHoldPercent` | **10** | فقط creator |
| `minMarketHoldPercent` | **20** | market position حفظ |
| `treasury.lifecycle.minRearmBalanceUsd` | **5000** | کف Main Fee برای rearm |
| `cronExpression` | `0 */4 * * *` | هر ۴ ساعت |

---

## هزینه هر چرخه — Solana (پیش‌فرض)

| line-item | محدوده | typical |
|-----------|--------|---------|
| AI (OpenAI) | $0.05 – $0.15 | $0.10 |
| Launch (Pump.fun) | $2 – $5 | $3 |
| ChangeNOW fee (۲۰۱ swap) | $2 – $8 | ~$5 |
| ETH gas (۲۰۱ USDC deposit) | $80 – $350 | ~$150 |
| USDC→SOL اصل (۲۰۱ wallet) | ~$455 | می‌چرخد — نه burn |
| Blitz gas + fees (675 trades) | $60 – $200 | ~$120 |
| **C_op burn (واقعی)** | **$150 – $500** | **~$280 – $380** |
| **Peak USDC از Main Fee** | ~$455 + fees | لحظه funding |

> BSC: min ChangeNOW معمولاً بالاتر · BNB gas کمتر · net مشابه یا کمی گران‌تر.

### فرمول runway

```
runway_cycles ≈ (MainFeeUsd − minRearmBalanceUsd) / avg_net_burn_per_cycle

با MainFee = $5,000 و minRearm = $5,000:
  → runway = 0 چرخه اضافی بدون بازگشت drain/profit
  → یعنی: هر چرخه full باید با drain/profit سرمایه را recycle کند

با MainFee = $10,000:
  → runway ≈ ($10,000 − $5,000) / $320 ≈ 15 چرخه buffer
  (با در نظر گرفتن ETH gas ChangeNOW + Blitz burn)
```

---

## سه سطح سرمایه

### سطح ۱ — تست ($800 – $1,000)

| | |
|--|--|
| Settings | `marketWalletCount: 100` · `maxInvestmentUsd: 1000` · cron `0 */8 * * *` |
| چرخه | ۳–۸ چرخه |
| Blitz | نیمه‌کامل — hit spec **شانسی** |
| مناسب | «ببینم سیستم چطور کار می‌کند» |

### سطح ۲ — کار جدی ($5,000) ← **پیش‌فرض v3**

| | |
|--|--|
| Settings | defaults فعلی — 200 wallet · $5K cap |
| Blitz | +500% · $100K vol · 150 tpm · visibility full |
| Bot magnet | signal bundle 12/12 GREEN هدف |
| Runway | ۱ چرخه full + recycle via drain/TWAP |
| مناسب | **«حداکثر spec با کمترین سرمایه معقول»** |

### سطح ۳ — production ($10,000)

| | |
|--|--|
| Buffer | ~$5K بالای minRearm |
| Runway | ~25–30 چرخه بدون واریز |
| BSC + SOL | هر دو شبکه راحت |
| مناسب | «ماه‌ها بدون استرس rearm» |

---

## جدول یک‌نگاه

| Main Fee | چرخه full 200w | Blitz spec | Bot magnet | rearm auto |
|----------|---------------|------------|------------|------------|
| $500 | ❌ block | ❌ | ❌ | ❌ |
| $1,000 | ⚠️ 100w | ⚠️ | ⚠️ | ⚠️ |
| **$5,000** | **✅** | **✅** | **✅** | **✅** |
| **$10,000** | **✅✅** | **✅** | **✅** | **✅ + buffer** |

---

## چطور Main Fee را شارژ کنید

```
65%  →  USDC on Ethereum     (منبع ChangeNOW → SOL/BNB per wallet)
25%  →  ETH on Ethereum      (gas: ۲۰۱ USDC deposit + margin — حیاتی)
10%  →  USDC on Solana       (اختیاری · rearm/direct · بدون ChangeNOW fee)
```

| دارایی | شبکه | نقش |
|--------|------|-----|
| **USDC** | Ethereum | منبع اصلی funding (ChangeNOW payin) |
| **ETH** | Ethereum | **اجباری** — بدون آن ۲۰۱ deposit گیر می‌کند (`waiting`/`expired`) |
| USDC | Solana | bypass ChangeNOW اگر مستقیم fund کنی |

**کف سیستم:** `minRearmBalanceUsd: 5000` — زیر این rearm block می‌شود.

**کف عملیاتی پیشنهادی با ETH gas:**

| Main Fee کل | USDC@ETH | ETH@ETH (buffer gas) |
|-------------|----------|----------------------|
| $5,000 | ~$3,250 | ~**$150 – $200** |
| $10,000 | ~$6,500 | ~**$200 – $300** |

---

## محافظ‌های خودکار (بدون دخالت دست)

| محافظ | trigger | action |
|-------|---------|--------|
| **Budget guard** | C_op ≥ maxInvestmentUsd | stop market session |
| **Funding gate** | wallet funding > 85% budget | abort FUNDING step |
| **Creator cap** | owner > 10% supply | OWNER_TRIM |
| **Market floor** | market < 20% supply | stop TWAP |
| **sellInRed** | price negative | defer sell |
| **Security gate** | score < 70 | abort launch |
| **Emergency brake** | manual GLOBAL | halt + drain → Main Fee |

**ترمز دستی فقط panic** — روزمره لازم نیست.

---

## سناریوهای سود

| سناریو | چه اتفاقی می‌افتد | C_op burn | inflow | نتیجه |
|--------|-------------------|-----------|--------|--------|
| **BLITZ_MISS** | spec نرسید — bundle < 12 GREEN | $280 | $0 – $50 | **−$230 تا −$280** |
| **Partial hit** | ۸–۱۱ GREEN — indexing هست، cascade ضعیف | $320 | $200 – $800 | **−$120 تا +$480** |
| **Full hit** | **12/12 GREEN** — bot magnet فعال | $380 | $2K – $20K+ | **+$1.6K – +$19K+** |
| **Viral** | full hit + CT/FOMO بیرونی | $400 | $50K+ | outlier — نادر |

> سناریو ۳ = همان چیزی که گفتی: **گردش بالا → کپ/ولوم/سیگنال GREEN → ربات‌ها خودشان می‌آیند** → TWAP سود را lock می‌کند.

---

## چک‌لیست قبل از شروع

- [ ] Main Fee ≥ **$5,000** — **USDC@Ethereum + ETH@Ethereum (~$150+)** نه فقط USDC
- [ ] ChangeNOW API key فعال · `GET /integrations/health` → `changenow: up`
- [ ] `minTradeAmountUsd: 2` — زیر min لحظه‌ای ChangeNOW funding fail می‌شود
- [ ] `maxInvestmentUsd: 5000` در settings
- [ ] `maxTokenHoldPercent: 10` (creator cap)
- [ ] `sellInRed: false` — **هرگز عوض نکن**
- [ ] QuickNode premium RPC (Solana) — 150 tpm بدون bottleneck
- [ ] Worker روشن: `npm run start:worker`
- [ ] Telegram وصل — گزارش هر چرخه
- [ ] می‌دانی **سود تضمین نیست**
- [ ] برنامه drain هر **۵–۱۰ چرخه**: `POST /treasury/drain`

---

## کارمزدهای مهم

| item | هزینه |
|------|-------|
| Launch Solana | ~$2 – $5 |
| Launch BSC | ~$5 – $15 |
| **ChangeNOW swap fee** | ~**0.25 – 1%** per order (~0.5% typical) |
| **ChangeNOW min** | **$1.7 – $20** dynamic — کد `getMinAmountV2` check |
| **ETH gas (USDC deposit)** | ~**$0.40 – $2.50** × ۲۰۱ orders per cycle |
| PumpPortal trade fee | ~0.5% notional |
| BSC swap | ~0.25% + gas |
| OpenAI trend+logo | ~$0.05 – $0.15 |
| Jito bundle (launch) | ~$0.01 – $0.05 |

---

## FAQ

**Q: ChangeNOW minimum چقدره؟**  
A: ثابت نیست — per pair از API. معمولاً USDC→SOL حدود **$2** ولی تا **$20** هم می‌رود. سیستم اگر `amountPerWalletUsd` زیر min باشد → `FAILED`. قبل از چرخه health check کن.

**Q: چرا ETH زیاد لازم است؟**  
A: هر wallet = ۱ سفارش ChangeNOW = ۱ USDC transfer روی Ethereum. ۲۰۱ wallet ≈ **$80–350** فقط gas deposit — جدا از fee ChangeNOW.

**Q: $5K بریزم، هر ۴ ساعت چرخه، ماه‌ها بدون شارژ؟**  
A: فقط اگر TWAP + organic سود برگرداند و drain recycle کند. buffer واقعی → **$10K**.

**Q: ربات‌ها واقعاً خودشان می‌آیند؟**  
A: بله — **اگر** Signal Bundle 12/12 GREEN شود. ربات فیلتر می‌خواند نه احساس. Blitz + 200 wallet + 150 tpm برای رسیدن به Vol/MC/tx/wallet thresholds طراحی شده. miss = spec نرسید، نه «ربات نخواست».

**Q: سود حداکثر چقدره؟**  
A: نامحدود theoretically. realistically: **۰ تا چند هزار $** per چرخه successful. **−$230 تا −$380** per miss (شامل ETH gas ChangeNOW).

**Q: 200 wallet vs 150؟**  
A: v3 = 200 — holder spread بهتر، GMGN/DexScreener indexing قوی‌تر، funding ~$500.

**Q: creator 10% یعنی فقط 10% توکن دست ماست؟**  
A: **نه.** 10% فقط **creator visible**. market wallets **20–35%+** اضافه — control غیرمستقیم.

**Q: چطور وضعیت ببینم؟**  
A: `GET /profit-extractor/status/{cycleId}` · `GET /cycles/{id}` · Telegram alerts

---

## پیوست فنی

<details>
<summary>فرمول‌ها و line-item (کلیک کنید)</summary>

### ChangeNOW funding (کد)

```
۲۰۱ wallet × fundWallet() — هر کدام:
  1. GET min-amount v2 (pair USDC:SOLANA | USDC:BSC)
  2. اگر amountUsd < min → ChangeNowValidationError → FAILED
  3. estimate → create exchange → USDC transfer (Ethereum) → poll تا finished
  4. concurrency: 20 parallel (runtime.changeNow.fundingConcurrency)

burn per cycle ≈ (201 × CN_fee%) + (201 × ETH_gas_per_deposit)
principal ≈ 201 × amountPerWalletUsd (~$2.3) → SOL در wallet — می‌چرخد
```

### Budget enforcement (کد)

```
Upfront funding ≤ 0.85 × maxInvestmentUsd
Runtime: funding_spent + gas_spent ≥ maxInvestmentUsd → STOP session

validateFundingBudget(201 wallets × ~$2.3) ≈ $463 ≤ $4250  ✅ @ $5K cap
(فقط اصل USDC — ETH gas و CN fee جدا در ledger/debit)
```

### Blitz volume (پیش‌فرض v3)

```
trades ≈ targetTradesPerMinute × ignitionMinutes
       = 150 × 4.5 ≈ 675 trades

visible volume contribution ≈ trades × avg_trade_usd × 2 (buy+sell mix)
       ≈ 675 × $2 × ~1.3 ≈ $1,750+ internal notional
       (DexScreener vol includes organic — target $100K 5m is setpoint not cash needed)
```

### Profit extract

```
Owner cap:  ownerHeld / supply ≤ maxTokenHoldPercent (10%)
Market TWAP: batch = min(excess_market × sellBatchRatio, 1.5% supply)
Stop TWAP:   marketHeld / supply ≤ minMarketHoldPercent (20%)
Gate:        sellInRed=false → no sell on negative 5m price
```

### Emergency

```
POST /emergency/brake { "scope": "GLOBAL" }
  → halt all queues → sell all → sweep SOL/BNB → Main Fee
  → system HALTED until POST /emergency/resume
```

### References

- `src/common/funding/cycle-budget.util.ts`
- `src/integrations/changenow/changenow-funding.service.ts`
- `src/modules/profit-extractor/holding-calculator.service.ts`
- `docs/settings.defaults.json`
- `docs/main-info.md` §18 · §19 · §25

</details>

---

*v3.0 — Production cost model · [`implementation-roadmap.md`](./implementation-roadmap.md) · [`external-integrations.md`](./external-integrations.md) · [`cursor-stage-prompts.md`](./cursor-stage-prompts.md)*
