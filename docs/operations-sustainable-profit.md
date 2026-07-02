# Sustainable Profit Operations (v1.0)

> **هدف:** سود پایدارتر با بافر $10K، drain منظم، و سیکل فقط در ساعات پیک memecoin — نه هر ۴ ساعت کورکورانه.  
> **تنظیمات:** [`settings.defaults.json`](./settings.defaults.json) · **کد:** `src/common/scheduling/cycle-schedule.util.ts`

---

## 1. پروفایل توصیه‌شده production ($10K tier)

| پارامتر | مقدار | چرا |
|---------|-------|-----|
| `maxInvestmentUsd` | **10000** | بافر کافی برای ۲۰۱ ChangeNOW + گاز ETH + ۲۰۰ ولت |
| `marketWalletCount` | **200** | چگالی سیگنال DexScreener/GMGN برای bot magnet |
| `networkPriority` | **SOLANA اول** | pump.fun تراکم bot بالاتر |
| `minRearmBalanceUsd` | **5000** | کف rearm بعد از drain |
| `sellInRed` | **false** | هرگز عوض نکن |
| `maxCyclesPerDay` | **3** | کیفیت > کمیت |
| `minMinutesBetweenCycles` | **90** | فاصله برای جمع شدن نقدینگی |

---

## 2. ساعات پیک (UTC) — `strategy.cycleSchedule`

کرون `*/15 * * * *` فقط **تیک** می‌زند؛ شروع سیکل فقط اگر guard عبور کند.

### پنجره‌های پیش‌فرض

| برچسب | روزها (UTC) | ساعت UTC | معادل تقریبی |
|-------|-------------|----------|--------------|
| `US_weekday_core` | دوشنبه–جمعه | 14:00–22:00 | NY/LA روز کاری |
| `US_weekday_evening` | دوشنبه–جمعه | 22:00–02:00 | evening degen US |
| `weekend_degen` | جمعه–یکشنبه | 12:00–04:00 | آخر هفته |

### ساعات مسدود (نقدینگی پایین)

`blockedHoursUtc`: **04–10 UTC** — حتی اگر در پنجره باشی، شروع نمی‌شود.

### محدودیت نرخ

- حداکثر **۳ سیکل در روز** (شمارش از `startedAt`، بدون ABORTED)
- حداقل **۹۰ دقیقه** بین دو شروع
- اگر سیکل فعال باشد → skip (`active_cycle_running`)

### API دستی

```http
POST /api/v1/core-trigger/cycles
{ "ignorePeakSchedule": true }
```

فقط برای تست اپراتور — هنوز اگر سیکل فعال باشد block می‌شود.

---

## 3. Auto-drain — `treasury.lifecycle.autoDrain`

| فیلد | پیش‌فرض | توضیح |
|------|---------|--------|
| `enabled` | `true` | بعد از هر N سیکل COMPLETED |
| `everyNCycles` | **6** | ~۲ هفته با ۳ سیکل/روز |
| `convertTo` | `NATIVE` | SOL/BNB به Main Fee (نه USDC) |
| `fallbackCron` | `0 6 * * 1` | دوشنبه ۰۶ UTC اگر شمارنده fire نشد |

**جریان:** `CoreTriggerService` بعد از COMPLETED → `TreasuryAutoDrainHookService` → Redis counter → در Nامین `POST drain` داخلی.

---

## 4. PATCH برای DB از قبل seed شده

```bash
curl -X PATCH "$API/settings" -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" -d @production-tier10k-patch.json
```

نمونه `production-tier10k-patch.json`:

```json
{
  "cronExpression": "*/15 * * * *",
  "maxInvestmentUsd": 10000,
  "strategy": {
    "cycleSchedule": {
      "enabled": true,
      "peakOnly": true,
      "maxCyclesPerDay": 3,
      "minMinutesBetweenCycles": 90
    }
  },
  "treasury": {
    "lifecycle": {
      "autoDrain": {
        "enabled": true,
        "everyNCycles": 6,
        "convertTo": "NATIVE",
        "fallbackCron": "0 6 * * 1"
      }
    }
  }
}
```

> `strategy` و `treasury` deep-merge می‌شوند — فقط فیلدهای لازم را بفرست.

---

## 5. چرا این از `0 */4 * * *` بهتر است

| هر ۴ ساعت | پیک + guard |
|-----------|-------------|
| ۶ سیکل/روز | حداکثر ۳ در ساعات داغ |
| اغلب off-peak (04–10 UTC) | مسدود خودکار |
| burn ChangeNOW بی‌هدف | فقط وقتی bot density بالاست |
| drain دستی فراموش می‌شود | هر ۶ سیکل + fallback هفتگی |

---

## 6. چک‌لیست go-live

1. Main Fee ≥ **$10K** (۶۵٪ USDC روی Ethereum + ۲۵٪ ETH برای گاز)
2. اولین boot: `settings` خودکار از `docs/settings.defaults.json` seed می‌شود (tier10k + max-magnet — بدون PATCH جدا)
3. `GET /integrations/health` سبز
4. یک سیکل dry-run: `POST /core-trigger/cycles { "dryRun": true }`
5. مانیتور لاگ: `Scheduled cycle skipped: outside_peak_window` خارج از پیک = **طبیعی**
6. بعد از ۶ سیکل: `treasury lifecycle job` با `reason: auto_drain_after_cycle_*`

---

## 7. Max Magnet (در seed پیش‌فرض)

همهٔ پارامترهای magnet در `docs/settings.defaults.json` است — پروژه هنوز ران نشده؛ فایل PATCH جدا لازم نیست.

| پارامتر | مقدار | چرا |
|---------|--------|-----|
| `minTradeAmountUsd` | 5 | Dex/aggregator حداقل ~$5 برای نمایش trade |
| `buyBiasPercent` | 78 | فشار خرید پایه بالاتر در visibility |
| `targetTradesPerMinute` | 165 | نزدیک سقف blitz برای vol/holders |
| `strategy.visibility.minBuySellRatio` | 1.8 | سیگنال خرید قوی‌تر برای GMGN |
| `jitoBundleAtLaunch` | true | INDEX همان بلاک — Dex سریع‌تر |
| `trendStyleDefault` | controversial | کلیک بیشتر روی نام ترند |
| `tradeDelayMs` | 200–800 | human-like — کمتر wash flag |
| `networkPriority` | SOLANA اول | تراکم بات pump.fun |

بعداً فقط API keys / RPC را با `PATCH /settings` عوض کن.

---

## 8. سود حداکثری — انتظارات واقع‌بینانه

- Bot inflow **مکانیکی** است وقتی vol/MC/signal به آستانه برسد — تضمین نیست.
- `maxTokenHoldPercent: 10` = سقف creator؛ market TWAP در GREEN سود را می‌کشد بیرون.
- Emergency brake فقط panic — نه روال.
- سود پایدار = **کمتر سیکل در ساعت درست** + **buffer بزرگ‌تر** + **drain منظم**.
