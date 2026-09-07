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
| **Purchase / Repeat Purchase / Off-Peak Visit** | At checkout (point of sale), staff scans or manually enters the customer's personal code/QR → purchase and points are logged at that moment. This is the mechanism that answers "did we actually get a paying customer" — requires a simple POS-side interface (app or web page) for staff to use. **Fallback: retroactive claim** (see below) if the code wasn't scanned at checkout time. |

### Retroactive purchase claim (decided 2026-09-07)
Covers the common real-world case: staff or customer forgets to scan/enter the code at checkout.
- Customer opens the app afterward, selects something like "I forgot to scan my code," and uploads proof of purchase — either a **photo of the physical receipt** or a **screenshot of an online order confirmation**.
- AI reviews the submission: business name/logo matches, purchase date falls within the campaign window, amount looks plausible.
- **Higher-risk path than direct POS scan** since there's no staff witness at the moment of purchase, so extra safeguards apply:
  - **Time limit:** claim must be submitted within a short window after purchase (e.g. 48–72 hours), not indefinitely.
  - **Duplicate detection:** store a hash/fingerprint of the receipt image (and receipt number if visible) so the same receipt can't be claimed twice.
  - **Rate limiting:** cap how many retroactive claims one customer can submit in a given period, to blunt repeated abuse attempts.
  - **Default to more cautious review** than the direct-scan path — since there's no staff witness, retroactive claims should lean toward manual review (or a stricter AI confidence threshold) rather than being auto-approved as easily as a live POS scan.

### Point expiry & carryover (decided 2026-09-07)
Hybrid approach — not a clean pick of "expire" vs "carry over", but both combined:
1. **2-day grace period after campaign end.** Once a campaign's end_date passes, customers keep full access to their remaining point balance for 2 more days — they can still redeem any reward they've already earned enough for. An "ending soon" style notification (reusing the Phase 0.75 notification infrastructure) should also fire once the grace period itself is about to close, so customers don't lose track of the deadline.
2. **After the grace period, 30% of the remaining balance carries over; 70% is forfeited.** Whatever points a customer hasn't redeemed by the end of the grace window: 70% expires outright, and 30% is preserved as a **carryover credit** tied to that customer + business (not a specific future campaign, since the next campaign doesn't exist yet).
3. **Carryover is applied automatically when the same customer joins that business's next campaign** — the moment they get a new personal code for the new campaign, any pending carryover credit from a prior campaign of the same business is added to their new campaign's point balance as a starting bonus. Carryover credit has no separate expiry of its own once granted — it just becomes normal points in whatever campaign consumes it, subject to that campaign's own expiry rules.
4. If the business never runs another campaign, the carryover credit simply sits unconsumed — no separate cleanup logic needed for v1.

### Referral abuse prevention (decided 2026-09-07)
Three layers, all active in v1:
1. **OTP phone verification at signup** — applies to every customer joining any campaign (not referral-specific), not just referrals. A phone number must be confirmed via SMS OTP before the signup counts as real. This is the baseline identity check the other two layers build on — without it, self-referral via a second unverified number would be nearly free.
2. **Referral reward gated on a real qualifying action, not just signup** — the referrer's referral points stay in the same **Pending** state as any other task (plan.md AI review system) until the referred customer completes a real action, specifically their **first purchase**. A referred signup with no purchase never pays out. This makes self-referral farming cost real money (an actual purchase), not just a spare SIM.
3. **Cap on referrals counted per customer per campaign** — a per-campaign maximum (default suggestion: 10) on how many referrals earn points for one referrer, to blunt large-scale abuse even if layers 1–2 are partially defeated. Referrals beyond the cap can still happen (the referred person still joins normally) but simply stop earning the referrer additional points.
Pattern-matching/anomaly detection on suspicious referral clusters (e.g. many referred numbers with zero activity) is a good Phase 2+ addition but not built for v1 — the three layers above are the actual defense for launch.

### Reward redemption fulfillment (decided 2026-09-07)
How in-store staff verify a reward redemption is legitimate at the moment of fulfillment (e.g. handing over a free item or applying a discount).
- **Not** the customer's ongoing personal campaign code/QR — that code gets shown often (every purchase scan), so it's a weaker point to gate a reward on.
- Instead: when the customer taps **Redeem** in-app for a specific reward, the system generates a **separate, one-time redemption code/QR**, short-lived (e.g. 5–10 minute expiry). The customer shows *this* code to staff, who scan it via the same POS PWA — a dedicated "Fulfill Reward" action, distinct from the purchase-scan action.
- Once scanned (or once it expires unused), the code is invalidated — can't be reused or shown to a different staff member later.
- Chosen over reusing the standing personal code because a fresh, short-lived, single-use code closes the reuse/screenshot-sharing risk that a long-lived code carries, at the cost of one extra tap for the customer (Redeem → show code), which is an acceptable trade-off for something as valuable as a reward payout.

### Why AI-reviewed screenshots (not pure self-report, not manual-only review)
- Pure self-report ("I did it, trust me") has no fraud resistance — rejected.
- Manual-only admin review doesn't scale once there are many businesses/customers — AI review as the primary check, with the option to spot-check manually later if fraud patterns emerge.
- The personal code embedded in shared content solves what a screenshot alone can't: proving *which* customer posted it, not just that *a* post exists.

### POS-side UX (decided 2026-09-07)
- **Staff device:** primary is a **web app (PWA)** on the staff's own phone/tablet — no install, no app-store friction, works on whatever device the business already has. A dedicated installable app is offered as a secondary option later (from app stores), but web-first is the priority since it removes onboarding friction for small businesses.
- **Code entry:** **hybrid** — QR is the primary method (staff scans with phone camera via the PWA, fastest path), with a **short numeric backup code** always available on the customer's screen in case the QR scan fails (bad lighting, camera issue, no data connection to load the QR image, etc.). Staff can type the short code manually as a fallback without breaking the checkout flow.

### AI review decision system (decided 2026-09-07)
- **Three-tier outcome, not binary:** every AI-reviewed submission (Follow screenshot, Share/Story screenshot, retroactive receipt claim) gets one of three outcomes based on the AI's confidence score:
  - **High confidence → Auto-approve.** Points awarded immediately.
  - **Low confidence → Auto-reject.** Customer is notified and can resubmit with clearer evidence rather than losing the task permanently on one bad photo.
  - **Middle/uncertain confidence → Held for manual review.** Not auto-approved or auto-rejected — goes into a review queue.
- **Who reviews "uncertain" cases:** starts with our **central team** (single consistent review console across all businesses/campaigns) since early-stage business owners are non-technical and reviewing takes judgment calibration. **Transition later** to letting each business owner review their own campaign's uncertain cases from their dashboard, once the review workflow and criteria are proven out — they know their own store/customers/receipts best, but shouldn't be the default from day one.
- **Points while pending:** a task/purchase under review sits in a **Pending** state and does **not** award points yet. Points are only credited once a submission is finally approved — whether that's an immediate AI auto-approve or a later manual approval. This avoids double-counting or gaming the pending window.
- Exact numeric confidence thresholds (e.g. what % counts as "high" vs "uncertain" vs "low") to be tuned empirically once real AI review data exists — not fixed in this plan.
- [x] **Offline handling — decided:** if the staff device has no internet at checkout, the scan/entry is **stored locally on the device** (not blocked) and queued. Once connectivity returns, queued entries sync to the server, where **final verification happens against the central database** (checking the code is valid, not already redeemed/duplicated, etc.). Doing final verification server-side rather than trusting the offline device lowers fraud risk — a customer or staff member can't exploit the offline gap to redeem the same code twice, since the source of truth (and duplicate check) only lives on the server.

---

## Phase 0.75 — Notifications (SMS + Telegram) — decided 2026-09-07

Core question raised: campaigns are worthless if customers never hear about them or forget to come back. Need an outbound channel.

### Channels: both from the start (not staged)
- **SMS** — always available, no opt-in needed (phone number is already the primary customer identity).
- **Telegram** — Iran-relevant, but has a platform constraint: a business/bot **cannot** message a phone number directly. The customer must first **start a conversation with our Telegram bot** (opt-in). UX: when a customer joins a campaign, show a "open in Telegram for updates" link/button; if they tap it and hit Start, they're opted in from then on. If they never opt in, they still get SMS — Telegram is additive, never a replacement for SMS.
- **Send logic:** SMS is sent unconditionally for every triggered event; Telegram is sent additionally if-and-only-if the customer has opted in for that campaign. Redundancy over exclusivity — no picking "one channel per customer."

### Architecture approach: config-driven, like task/reward patterns
Rather than hardcoding channel-specific logic per event, follow the same abstraction-layer principle from Phase 1: a `notification_templates` config (trigger type × channel → message template), so adding a new trigger or a new channel later doesn't require new code paths, just new config rows. See architecture.md for the schema.

### Trigger events for v1 (decided — 4 events)
1. **Campaign invite** — sent when the business launches a campaign, to the business's existing customer contacts.
2. **Ending soon** — sent to enrolled customers who haven't finished when a campaign is approaching its end date (e.g. ~2 days left).
3. **Reward threshold reached** — sent the moment a customer's point balance crosses a `campaign_rewards.threshold_points` value, telling them they can redeem.
4. **Submission reviewed** — sent when a `task_submissions` row moves out of `pending` (AI or central-team review resolves to approved or rejected), so the customer isn't left wondering.

Other candidate triggers (task reminders mid-campaign, referral-success pings) were not requested for v1 — can be added later as more `notification_templates` rows, no architecture change needed.

### Initial audience acquisition (decided 2026-09-07) — hybrid
The campaign_invite trigger needs a list of phone numbers to send to. Two complementary sources, both v1:
1. **Manual list upload** — business uploads a CSV/Excel of existing customer phone numbers during onboarding or before launch. Covers businesses that already keep a contact list (POS exports, WhatsApp groups, etc.).
2. **Public join link / QR** — every campaign gets a shareable public link + QR code (for Instagram bio, a printed poster in-store, etc.) that lets a new customer self-join directly — enters their phone number, gets their personal code, no pre-existing contact record needed. This is the primary path for businesses with no list at all, and it also keeps growing the contact base after initial launch, not just at launch time.
Instagram-follower-list import was explicitly ruled out — Instagram's API doesn't expose follower phone numbers/DMs for this kind of use, so it only works for the existing size-tier follower *count* signal (plan.md decision #3), not for actually reaching people.

### Business microsite / landing page templates (decided 2026-09-07, v1 add-on)
For businesses that don't already have a website: an **optional** extra beyond the campaign itself.
- A small curated set of **pre-built, minimal/elegant website templates** (not a page builder/CMS) that a business can pick from and deploy as their own real site — not just a bare join-link page.
- Business customizes only basic content within the chosen template: logo, name, tagline/description, a few images, contact info. No layout editing — keeps it fast and prevents businesses from producing a messy, unprofessional result.
- The campaign's public join link/QR (see above) gets embedded prominently on the deployed site, so the microsite doubles as both a real web presence and an on-ramp into the current campaign.
- Deployed to a hosted subdomain (e.g. `{business-slug}.ourdomain.com`) — no separate hosting/domain setup needed by the business.
- Explicitly **optional and additive** — a business with no interest in a website just uses the plain join link; this doesn't block or complicate that path.
- Scope guardrail: this is a small template gallery, not a general website builder — multi-page custom sites, editable layouts, or a full CMS are out of scope for v1 and would pull focus away from the core campaign-builder product.

---

## Phase 0.9 — Pricing & Revenue Model — decided 2026-09-07

Three components, combined:

1. **Monthly subscription, priced by size tier.** Reuses the existing Micro/Small/Medium/Large size-tier system (plan.md decision #3) — each tier has its own monthly subscription price. This covers ongoing access to the core campaign builder (onboarding flow, task/reward generation, dashboard, insights).
2. **SMS billed separately, by volume.** SMS has a real per-message cost to us, so it's **not** bundled into the flat subscription — businesses are billed based on actual SMS notification volume sent (plan.md Phase 0.75 notification triggers). Telegram sends stay free/bundled since they don't carry a comparable per-message cost.
3. **Business microsite is a separate optional add-on fee.** The template-based landing page/website (plan.md Phase 0.75 "Business microsite") is not included in the base subscription — a business that wants one pays an additional add-on charge on top of their tier subscription.

Not decided yet / left for implementation: exact price points per tier, exact SMS per-message rate, and exact microsite add-on price — these are business/finance decisions to set closer to launch, not architecture. What's fixed here is the **shape** of the pricing model (tier subscription + metered SMS + optional paid add-on), so the schema can be built now.

---

### Business owner authentication (decided 2026-09-07)
Business owners sign up / log in with **phone number + SMS OTP only** — no email/password option in v1. Chosen for consistency with the customer-facing flow (same OTP mechanism already decided for referral abuse prevention, plan.md Phase 0.5) and because it's lower-friction for this segment (small business owners, not necessarily tech-savvy, for whom a phone number is the natural identity anyway — same reasoning as customers). No password to forget, no reset-password flow needed. This is scoped to the **business owner's own account**; it's separate from the in-store staff POS interface, which doesn't need its own login concept yet (see architecture.md `businesses` table).

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

**Newly surfaced (2026-09-07), not yet resolved:**
- [x] How does a business import its initial customer contacts? — **decided: hybrid, manual CSV/Excel upload + public join link/QR** (see Phase 0.75 "Initial audience acquisition" above; new `business_contacts` table in architecture.md).
- [x] Physical reward fulfillment — **decided: one-time, short-lived redemption code/QR generated on Redeem tap**, separate from the standing personal campaign code (see Phase 0.5 "Reward redemption fulfillment" above).
- [x] Referral abuse prevention — **decided: three layers, all v1 — OTP phone verification at signup, referral reward gated on referred customer's first purchase (not just signup), and a per-campaign cap on referrals counted per referrer** (see Phase 0.5 "Referral abuse prevention" above).
- [x] Point expiry — **decided: hybrid — 2-day grace period after campaign end, then 70% of remaining points forfeited and 30% preserved as a carryover credit automatically applied when the customer joins the same business's next campaign** (see Phase 0.5 "Point expiry & carryover" above).
- [x] Revenue/pricing model — **decided: monthly subscription priced by size tier + SMS billed separately by volume + business microsite as a separate optional paid add-on** (see new Phase 0.9 "Pricing & Revenue Model" above). Exact price points left for a later business/finance decision.
- [x] Business owner authentication — **decided: phone number + SMS OTP only**, no email/password (see new "Business owner authentication" section above).
- [ ] SMS budget/cost control: since SMS has a real per-message cost, does a business need a spending cap or usage limit on notification sends?

---

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
- **2026-09-07** — Follow-up decisions:
  - Size-tier point/budget multiplier table defined (4 tiers: Micro/Small/Medium/Large — see decision #3 above).
  - Early-adopter plan defined, then **revised**: product-first approach — build the MVP, then onboard early-adopter businesses through the real product. Dropped the earlier idea of a manual/pre-product spreadsheet+WhatsApp tracking phase, since data collected outside the real product risks not reflecting actual app behavior.
  - UI/onboarding screen design explicitly deferred — infrastructure gaps take priority.
  - **New critical topic surfaced and resolved: Attribution & Tracking Mechanism (Phase 0.5).** Defined a personal-customer-code system as the backbone for verifying every task type: AI-reviewed screenshots (+ embedded personal code) for social tasks, automatic code-based linking for referrals, and staff-scanned QR/code at point-of-sale for purchases. This was a genuine gap — without it, none of the weighting/benchmark/insight work has real data to run on.

  **Next up:** (a) POS-side UX design (how staff scan/enter codes at checkout), (b) AI screenshot-review logic (pass/fail/uncertain handling), (c) overall system architecture / data model (campaign, task, reward, customer-code schema) — needed before MVP build can start.
- **2026-09-07** — Phase 0.5 (Attribution & Tracking) fully closed out:
  - POS-side UX decided: web app (PWA) primary for staff, installable app secondary; hybrid QR + short numeric backup code for customer identification.
  - Offline handling decided: local queue on the staff device, final verification/duplicate-check happens server-side once synced.
  - Retroactive purchase claim mechanism added: customer can upload a receipt (photo or screenshot) afterward if the code wasn't scanned at checkout, with time limits, duplicate detection, and rate limiting to control the added fraud risk.
  - AI review decision system decided: three-tier outcome (auto-approve / auto-reject / hold for manual review) instead of binary; central team reviews uncertain cases initially, moving to per-business-owner review later; points stay in a Pending state and are only credited on final approval.

  **Next up:** overall system architecture / data model (campaign, task, reward, customer-code, submission/review schema) — the natural next step now that the attribution mechanism it needs to represent is fully specified.
- **2026-09-07** — System architecture started: **tech stack decided — Node.js/TypeScript backend + PostgreSQL**, with the staff POS interface as a web app (PWA). Full entity/schema draft written up separately in **[architecture.md](./architecture.md)** (businesses, campaigns, task_patterns, category_pattern_weights, campaign_tasks, reward_patterns, campaign_rewards, customers, customer_campaign_codes, task_submissions, purchase_logs, points_ledger, benchmark_stats, insights) to keep plan.md from growing unmanageably long. See that file for the full schema and relationship diagram.

  **Next up:** resolve the three open implementation questions logged in architecture.md, then move toward a buildable MVP scope/task breakdown.
