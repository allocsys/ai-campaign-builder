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

## Phase 0.5 — Attribution & Tracking Mechanism (CRITICAL, decided 2026-09-07)

Core question raised: how do we actually know a campaign worked — how do we know a customer was acquired, a task was completed, a purchase happened? Without this, all the weighting/benchmark/insight work in Phase 1–2 has nothing real to measure.

### Core concept: personal customer code
Every customer who joins a campaign (signs up, typically via phone number) gets a **unique personal code/QR**. This single identifier is reused across every tracking mechanism below — one identity, multiple uses — rather than separate tracking schemes per task type.

### Tracking method per task type

| Task type | Verification method |
|---|---|
| **Follow** | Customer submits a screenshot of their own profile showing they follow the business account → reviewed by AI (vision model checks the screenshot shows a genuine follow). |
| **Share / Story / Social Proof** | Customer embeds their **personal code/link** in the story or post caption, then submits a screenshot → AI verifies both (a) the personal code is visible/correct and (b) the content genuinely matches the campaign (not an unrelated post). Combines identity proof (the code) with content proof (the screenshot + AI review). |
| **Referral** | Customer shares their personal code/link with a friend → the friend enters it at signup → system automatically links the new customer to the referrer. No manual verification needed — the code itself is the proof. |
| **Purchase / Repeat Purchase / Off-Peak Visit** | At checkout (point of sale), staff scans or manually enters the customer's personal code/QR → purchase and points are logged at that moment. This is the mechanism that answers "did we actually get a paying customer" — requires a simple POS-side interface (app or web page) for staff to use. |

### Why AI-reviewed screenshots (not pure self-report, not manual-only review)
- Pure self-report ("I did it, trust me") has no fraud resistance — rejected.
- Manual-only admin review doesn't scale once there are many businesses/customers — AI review as the primary check, with the option to spot-check manually later if fraud patterns emerge.
- The personal code embedded in shared content solves what a screenshot alone can't: proving *which* customer posted it, not just that *a* post exists.

### Open follow-up (needs implementation-level design, not blocking)
- Exact UX for staff at POS (dedicated small app? web page accessible from any phone/tablet at checkout? manual code entry as fallback if QR scan fails?)
- What the AI vision review flags as pass/fail/uncertain, and what happens on "uncertain" (auto-reject, hold for manual review, or auto-approve with low weight?)

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
  3. No dedicated "business size" question is added to onboarding — keeps the 30-second flow intact.

  **Size-tier mapping (v1 draft, 4 tiers):**

  | Tier | Followers/existing customers | Offer budget (Toman) | Point multiplier | Suggested duration |
  |---|---|---|---|---|
  | Micro | < 500 | < 30,000 | 0.7x | 10 days |
  | Small | 500–2,000 | 30,000–100,000 | 1x (base) | 14 days |
  | Medium | 2,000–20,000 | 100,000–500,000 | 1.5x | 21 days |
  | Large | > 20,000 | > 500,000 | 2x | 30 days |

  Point multiplier scales the base point values of each task pattern (e.g. base Follow = 10 points → 15 points at Medium tier). Duration is the AI's suggested default, editable by the business owner.

  **Signal conflict rule:** if the follower/customer signal and the offer-budget signal point to different tiers, use the **higher** tier (assume more available resources rather than being conservative).
- [x] Data source for "benchmark" credibility — **decided: hybrid, run in parallel:**
  1. **Phase A (launch placeholder):** pull general industry/marketing data (loyalty program reports, retail & F&B marketing studies) to set reasonable initial defaults (e.g. typical acquisition discount %, typical referral task completion rates). Available immediately, but generic/not Iran-market-specific.
  2. **Phase B (parallel, ongoing):** once the MVP product is built, onboard a small batch of real early-adopter businesses (~5–10, free) to run real campaigns **inside the actual product**, and collect real completion/conversion data from there. **Revised (2026-09-07):** product comes first, then users — no manual/pre-product spreadsheet-and-WhatsApp tracking phase. Real usage data is only trustworthy once collected in the real product environment; manual tracking risks producing noisy data that doesn't reflect how the actual app will behave.

     **Early-adopter acquisition plan (v1, to run once MVP is ready):**
     - **Scope:** 1–2 businesses from each of the 6 v1 categories (roughly 6–12 total) rather than concentrating in just one or two categories — gives at least a thin data point per category instead of leaving some categories with zero real signal.
     - **Incentive (combined):** (a) fully free access/participation as a beta partner, framed as early access — no cost to them; PLUS (b) hands-on help actually designing and running their campaign inside the product (walking them through it, not just handing over a login). This matters because a small business owner often lacks the time/expertise to run a good campaign alone — without hands-on help the campaign risks being poorly run, producing low-quality/noisy data. The hands-on involvement also gives direct qualitative signal for tuning weights and benchmarks, beyond just the raw numbers.
     - **Mechanism:** onboarding happens through the real MVP product once it exists. No manual spreadsheet/WhatsApp tracking phase before that.
  3. As Phase B data accumulates, progressively replace Phase A generic defaults with real early-adopter benchmarks, category by category (e.g. once enough coffee shop campaigns have run, swap in real numbers for that category specifically rather than waiting for all categories at once).
- [x] Metric definitions for Phase 2 insights — **decided:**

  **"Low completion rate" scoring (hybrid, not single-source):**
  1. Compare a task's completion rate against the **cross-campaign benchmark** for that same task pattern + business category (from the Phase A/B benchmark data above).
  2. Compare it against the **within-campaign baseline** — average completion rate of the other tasks in the same campaign.
  3. Average the two deviation scores into one combined signal to decide the final "low / normal / high" flag. This avoids false positives from relying on just one comparison (e.g. a task might look low vs. benchmark but be normal for that specific campaign's context, or vice versa).

  **Insight cadence (three tiers, running together):**
  1. **Daily** — lightweight one-line digest per key metric (e.g. "Share: 12% — below average").
  2. **Weekly** (once ~7 days of data has accumulated) — fuller report: task/reward comparisons, correlations (e.g. the "Referral users buy 2.4x more" type insight), and concrete suggestions.
  3. **Anomaly-based** (event-triggered, independent of the daily/weekly clock) — immediate detailed alert whenever a metric deviates sharply/suddenly, so the business isn't stuck waiting for the next scheduled digest.

---

## Status Log
- **2026-09-07** — Repo created, initial plan drafted. Core onboarding flow + abstraction layer concept agreed on.
- **2026-09-07** — All 5 initial open questions resolved:
  1. v1 business categories → 6 categories (incl. beauty clinic)
  2. Task/reward pattern weighting → v1 draft table with 9 patterns (added First Action, Off-Peak, Anniversary/Birthday to original 6)
  3. Business-size scaling → hybrid proxy (connected app data + offer budget inference), no extra onboarding question
  4. Benchmark data source → hybrid: industry data as launch placeholder + parallel early-adopter data collection, category-by-category replacement over time
  5. Phase 2 insight metrics → hybrid completion-rate scoring (cross-campaign + within-campaign) + 3-tier cadence (daily/weekly/anomaly)

  **Next up:** no more open questions logged. Candidates for next planning session: (a) define the size-tier point/budget multiplier table referenced in decision #3, (b) sketch the onboarding UI/screen flow, (c) start scoping the early-adopter outreach (who, how many, what incentive) for benchmark Phase B.
