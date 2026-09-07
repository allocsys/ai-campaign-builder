# AI Campaign Builder — Plan

## Positioning
> Tell us your goal. AI builds the campaign.
> (فارسی: هدفت رو بگو؛ کمپینت رو بساز.)

Core principle: don't ask "what features do we add?" — ask "how do we turn campaign design into a 30-second task?"

---

## Phase 0 — Onboarding & Campaign Generation

### Core questions (universal, always asked)
1. کسب‌وکارت چیه؟ (Business type)
2. هدفت چیه؟ (Goal — e.g. new customer acquisition)
3. مخاطبت کیه؟ (Audience)
4. چه چیزی می‌تونی به مشتری بدی؟ (What can you offer — discount, gift, VIP)

### Conditional question (based on business type)
One extra question per business category, shown after Q1:

| Business type | Conditional question |
|---|---|
| Coffee shop / cafe | مشتری بیشتر حضوریه یا آنلاین/دلیوری؟ |
| Clothing store | فروش فصلی داری یا کالای همیشگی؟ |
| Restaurant | تمرکز روی سفارش مجدد یا تجربه حضوری؟ |
| Online store | چرخه خرید تکراریه یا یک‌بار مصرف؟ |
| Gym / fitness | هدف نگه‌داشتن مشتری قدیمیه یا جذب جدید؟ |
| Beauty clinic | خدمات یک‌باره یا پکیج/دوره‌ای؟ |

Implementation note: use a small fixed set of business categories with a pre-written conditional question each. Do NOT dynamically generate the conditional question — keep it deterministic for reliability and speed.

**✅ DECIDED (2026-09-07): v1 business categories = 6**
1. کافی‌شاپ / کافه (Coffee shop)
2. فروشگاه لباس / پوشاک (Clothing store)
3. رستوران / فست‌فود (Restaurant)
4. فروشگاه آنلاین — غیر پوشاک (Online store)
5. باشگاه / سالن ورزشی (Gym / fitness)
6. کلینیک زیبایی (Beauty clinic)

### Output: AI Campaign proposal
- Goal, duration, target audience (auto-filled from answers)
- Tasks (weighted/selected from the abstraction layer, see below)
- Rewards (selected from the abstraction layer)
- One Challenge (e.g. "do 3 activities in 7 days for a special reward")
- Two actions only: **Launch Campaign** / **Edit Campaign**

---

## Phase 1 — Abstraction Layer (Task & Reward Patterns)

Instead of hardcoding tasks/rewards per business type, define reusable behavioral patterns and weight them per category. This keeps the system scalable — adding a new business type later means adjusting weights, not building a new task/reward set.

### Base Task Patterns
- **Social Proof** — post, story, tag a friend (high weight: cafe, restaurant, beauty)
- **Referral** — invite a friend (all categories, variable weight)
- **Repeat Purchase / Order Again** — return within X days (retail, restaurant, online)
- **Milestone / Streak** — consecutive visits/activities (gym, subscription-based)
- **Specific Product Push** — order/try a specific item (cafe, retail)
- **Review / UGC** — leave a review, share a result photo (beauty, online store)

### Base Reward Patterns
- **Percentage Discount**
- **Free Item / Upgrade** (free drink, free dessert, size upgrade)
- **Free Shipping**
- **VIP / Membership Tier**
- **Promotional Item** (physical gift, merch)
- **Early Access** (new product/collection)

### Weighting table (to be refined)
Each business type maps to a weight (0–3) per pattern, controlling which tasks/rewards get suggested first and how many points they're worth. To be built as a config (JSON/table), not hardcoded logic.

---

## Phase 2 — Post-Launch Insights (NOT autopilot yet)

Dashboard evolves from static stats to AI-generated insights, but **read-only** at first:
- "Share نرخ تکمیل پایینی دارد."
- "کاربرانی که Invite Friend انجام داده‌اند، ۲.۴ برابر بیشتر خرید کرده‌اند."
- "پیشنهاد می‌کنم امتیاز Referral افزایش پیدا کند."

No auto-apply in this phase. Just surfaced insights.

## Phase 3 — Suggested Changes (Human-in-the-loop)

- AI suggests a specific change (e.g. "increase Referral points from 50 → 80")
- User reviews and clicks **Apply** to confirm
- Every change is logged/reversible

## Phase 4 — Opt-in Autopilot (long-term, NOT default)

- Only after a user has manually applied several AI suggestions (trust built)
- Offer an explicit opt-in toggle: "Auto-apply low-risk changes"
- Never on by default. Scope limited to low-risk parameters (e.g. point values), never budget/discount depth without confirmation.

---

## Open Questions / To Decide
- [x] Final list of business categories for v1 — **decided: 6 categories (see Phase 0 above)**
- [ ] Exact weighting values per pattern per category (needs real benchmark data ideally)
- [ ] How campaign duration/points scale with business size (small shop vs. large chain)
- [ ] Data source for "benchmark" credibility (real campaign data vs. reasonable defaults) — needed so AI suggestions don't feel generic/templated
- [ ] Metric definitions for Phase 2 insights (what counts as "low completion rate", etc.)

---

## Status Log
- **2026-09-07** — Repo created, initial plan drafted. Core onboarding flow + abstraction layer concept agreed on. Next: define v1 business categories and pattern weighting table.
