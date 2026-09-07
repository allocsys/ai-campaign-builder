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
- **First Action / Conversion** — first purchase, first order, first booking. Weight depends on **campaign Goal**, not just business type: high weight when Goal = "acquisition", low/zero when Goal = "retention" of existing customers.
- **Off-Peak / Time-based Visit** — bonus for activity during slow hours (e.g. 3–5pm order). High value for cafe, restaurant, gym to spread out traffic.
- **Anniversary / Birthday** — trigger tied to customer signup date or birthday. Useful re-engagement hook, esp. gym, beauty, clothing.

**Decided against for v1 (over-engineering risk):**
- Bundle/Cross-sell — more of a merchandising concern than gamification; revisit later.
- Geolocation Check-in — needs GPS/permission handling, too much technical overhead for v1.

### Base Reward Patterns
- **Percentage Discount**
- **Free Item / Upgrade** (free drink, free dessert, size upgrade)
- **Free Shipping**
- **VIP / Membership Tier**
- **Promotional Item** (physical gift, merch)
- **Early Access** (new product/collection)

### Weighting table (v1 draft — intuition-based, to refine with real data later)
Scale: 0 (not relevant) to 3 (core pattern for this business type).

| Pattern | کافی‌شاپ | لباس | رستوران | آنلاین | باشگاه | زیبایی |
|---|---|---|---|---|---|---|
| Social Proof | 3 | 2 | 2 | 1 | 1 | 3 |
| Referral | 2 | 2 | 2 | 2 | 2 | 2 |
| Repeat Purchase | 2 | 2 | 3 | 2 | 0 | 1 |
| Milestone/Streak | 1 | 0 | 0 | 0 | 3 | 1 |
| Specific Product Push | 3 | 1 | 2 | 1 | 0 | 0 |
| Review/UGC | 1 | 1 | 2 | 3 | 1 | 2 |
| First Action/Conversion | 2* | 2* | 2* | 3* | 2* | 2* |
| Off-Peak/Time-based | 2 | 0 | 2 | 0 | 2 | 1 |
| Anniversary/Birthday | 1 | 2 | 1 | 1 | 2 | 2 |

*First Action/Conversion weight shown assumes Goal = acquisition. This row should be dynamically overridden by the Goal answer (Q2 in onboarding): boost toward 3 when Goal = acquisition, drop toward 0–1 when Goal = retention/loyalty of existing customers. This is the one pattern that's Goal-driven rather than purely business-type-driven — keep that logic explicit in implementation, not baked into the static table.

Implementation: build as a config (JSON/table), not hardcoded logic, so weights can be tuned without code changes.

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
- [x] Exact weighting values per pattern per category — **decided: v1 draft table set (9 patterns, see Phase 1 above), intuition-based, to refine once real campaign data exists**
- [x] How campaign duration/points scale with business size — **decided: hybrid proxy, no extra onboarding question:**
  1. **Primary signal (if a connector is linked):** follower count / existing customer count from Instagram or the business's app. Higher count → scale up points/budget/duration.
  2. **Fallback signal (always available):** infer from the offer/budget the owner types in Q4 ("چه چیزی می‌تونی بدی؟") — e.g. a flat discount amount or free-item cost implies a rough per-customer cost ceiling, which caps how many points/tasks make sense before the reward becomes unprofitable.
  3. No dedicated "business size" question is added to onboarding — keeps the 30-second flow intact. Needs a simple size-tier mapping (e.g. small/medium/large → point multiplier + suggested duration) to be defined during implementation.
- [ ] Data source for "benchmark" credibility (real campaign data vs. reasonable defaults) — needed so AI suggestions don't feel generic/templated
- [ ] Metric definitions for Phase 2 insights (what counts as "low completion rate", etc.)

---

## Status Log
- **2026-09-07** — Repo created, initial plan drafted. Core onboarding flow + abstraction layer concept agreed on. Next: define v1 business categories and pattern weighting table.
