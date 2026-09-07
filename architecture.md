# System Architecture &amp; Data Model (v1 draft)

Companion to `plan.md`. This translates the product decisions in plan.md into a concrete schema. See plan.md for the reasoning behind each mechanism — this file just captures the resulting structure.

## Stack
- **Backend:** Node.js / TypeScript
- **Database:** PostgreSQL
- **Staff POS interface:** Web app (PWA), works on any phone/tablet, no install required

---

## Core Entities

### `business_categories` (lookup table, decided 2026-09-07)
Replaces a hardcoded `category` enum so a new category can be added later via a plain row insert, no schema migration needed.
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| slug | text, unique | e.g. coffee_shop, clothing, restaurant, online_store, gym, beauty_clinic (v1's 6 seed rows) |
| name_fa | text | Persian display name |
| active | boolean | lets a category be retired without deleting historical data |
| created_at | timestamp | |

### `businesses`
The business owner account.
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | text | |
| category_id | uuid | FK → business_categories (was a hardcoded enum, changed 2026-09-07 for migration-free category additions) |
| phone | text | |
| instagram_handle | text, nullable | used for size-tier signal if connected |
| size_tier | enum, computed | micro / small / medium / large (see plan.md size-tier mapping) |
| created_at | timestamp | |

### `campaigns`
One campaign belongs to one business.
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| business_id | uuid | FK → businesses |
| goal | enum | acquisition, retention (drives First Action pattern weight override — see plan.md) |
| audience_description | text | free text from onboarding Q3 |
| offer_description | text | free text from onboarding Q4, also used for size-tier budget signal |
| status | enum | draft, active, ended |
| point_multiplier | numeric | resolved from business.size_tier at campaign creation |
| start_date / end_date | timestamp | end_date derived from size-tier suggested duration, editable |
| public_join_slug | text, unique | short public code/slug used to build the shareable join link + QR (plan.md Phase 0.75 audience acquisition) |
| max_referrals_per_customer | int | default 10 (plan.md "Referral abuse prevention") — cap on how many referrals earn a given referrer points in this campaign |
| created_at | timestamp | |

### `task_patterns` (global config, not per-campaign)
The 9 base patterns from plan.md Phase 1. Seeded once, not created per business.
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | enum | social_proof, referral, repeat_purchase, milestone_streak, specific_product_push, review_ugc, first_action, off_peak, anniversary_birthday |
| verification_method | enum | screenshot_ai, code_link_auto, pos_scan, receipt_claim (maps to plan.md's attribution table) |
| base_points | int | before size-tier multiplier |

### `category_pattern_weights` (global config)
The weighting table from plan.md Phase 1 — one row per (category, pattern) pair.
| Field | Type | Notes |
|---|---|---|
| business_category_id | uuid | FK → business_categories (was enum, see decision above) |
| task_pattern_id | uuid | FK → task_patterns |
| weight | int (0-3) | drives which patterns get suggested/how prominently |

### `campaign_tasks`
A task pattern actually included in a specific campaign (chosen by weight + goal at generation time, editable after).
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| campaign_id | uuid | FK → campaigns |
| task_pattern_id | uuid | FK → task_patterns |
| points_value | int | base_points × campaign.point_multiplier, editable |
| display_order | int | |

### `reward_patterns` (global config)
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | enum | percentage_discount, free_item, free_shipping, vip_tier, promo_item, early_access |

### `campaign_rewards`
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| campaign_id | uuid | FK → campaigns |
| reward_pattern_id | uuid | FK → reward_patterns |
| threshold_points | int | points needed to unlock |
| description | text | e.g. "10% off next visit" |

### `customers`
A person, identified by phone number, independent of any one campaign.
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| phone_number | text, unique | primary identity |
| telegram_chat_id | text, nullable | set once customer starts a conversation with our Telegram bot (plan.md Phase 0.75 opt-in flow) |
| telegram_opted_in | boolean | default false; Telegram sends only happen if true, SMS always sends regardless |
| created_at | timestamp | |

### `customer_campaign_codes`
The **personal code/QR** concept from plan.md — one per customer per campaign (not one global code across all campaigns, since points/progress are campaign-scoped).
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| customer_id | uuid | FK → customers |
| campaign_id | uuid | FK → campaigns |
| personal_code | text, unique | short numeric backup code (manual entry fallback) |
| qr_payload | text | encodes id/code for camera scan |
| referred_by_code_id | uuid, nullable | FK → customer_campaign_codes.id — set if this customer joined via someone else's referral code |
| created_at | timestamp | |

### `task_submissions`
Every attempt at completing a task — the central table the AI-review system (plan.md) operates on.
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| customer_campaign_code_id | uuid | FK → customer_campaign_codes |
| campaign_task_id | uuid | FK → campaign_tasks |
| submission_type | enum | screenshot, receipt_claim, pos_scan, referral_auto |
| evidence_url | text, nullable | screenshot/receipt image location |
| ai_confidence_score | numeric, nullable | 0–100, null for pos_scan/referral_auto (no AI review needed) |
| status | enum | pending, approved, rejected |
| reviewed_by | enum, nullable | ai, central_team, business_owner |
| submitted_at / reviewed_at | timestamp | |
| points_awarded | int, nullable | set only on approval — see plan.md "points while pending" rule |

### `purchase_logs`
Specifically for purchase-type tasks (Purchase, Repeat Purchase, Off-Peak), linked 1:1 with a `task_submissions` row of type `pos_scan` or `receipt_claim`.
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| task_submission_id | uuid | FK → task_submissions |
| amount | numeric, nullable | purchase amount if known |
| receipt_hash | text, nullable | for duplicate-claim detection (plan.md retroactive claim rules) |
| synced_from_offline | boolean | true if this came through the offline queue |
| created_at | timestamp | |

### `reward_redemptions` (decided 2026-09-07)
One row per reward claim by a customer. Gives redemptions their own lifecycle (e.g. fulfillment status) instead of being just a bare negative points_ledger entry.
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| customer_campaign_code_id | uuid | FK → customer_campaign_codes |
| campaign_reward_id | uuid | FK → campaign_rewards |
| points_spent | int | should equal campaign_rewards.threshold_points at time of redemption |
| status | enum | pending, fulfilled, cancelled |
| redemption_code | text, unique, nullable | one-time short-lived code/QR (plan.md "Reward redemption fulfillment"), generated when customer taps Redeem, distinct from the standing personal campaign code |
| redemption_code_expires_at | timestamp, nullable | code becomes invalid after this (e.g. 5–10 min from generation) |
| fulfilled_at | timestamp, nullable | set when staff scans the redemption_code via the POS PWA's Fulfill Reward action |
| redeemed_at | timestamp | when the customer initiated the redemption (tapped Redeem, points deducted) |

### `points_ledger`
Append-only transaction log — the source of truth for a customer's point balance in a campaign.
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| customer_campaign_code_id | uuid | FK |
| task_submission_id | uuid, nullable | FK — null for manual adjustments or redemptions |
| reward_redemption_id | uuid, nullable | FK → reward_redemptions — set when this entry is a redemption (negative points); null otherwise |
| points | int | positive (earned) or negative (redeemed/reward claimed) |
| created_at | timestamp | |

### `benchmark_stats` (supports plan.md's Phase A/B benchmark system)
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| business_category_id | uuid | FK → business_categories (was enum, see decision above) |
| task_pattern_id | uuid | FK → task_patterns |
| source | enum | industry_data (Phase A), early_adopter (Phase B) |
| completion_rate | numeric | |
| sample_size | int | |
| updated_at | timestamp | |

### `business_contacts` (decided 2026-09-07)
A business's raw phone-number list, independent of campaign enrollment — feeds the campaign_invite notification. Not the same as `customers`/`customer_campaign_codes`, which only exist once someone has actually joined a campaign.
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| business_id | uuid | FK → businesses |
| phone_number | text | not unique globally — same number can be a contact of multiple businesses |
| source | enum | manual_upload, self_joined (added automatically once someone joins via the public link, so they're tracked for future campaigns too) |
| imported_at | timestamp | |

### `website_templates` (global config, decided 2026-09-07)
The curated template gallery businesses pick from — config-driven like task/reward patterns, so adding a new template is a new row, not new code.
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | text | e.g. "Minimal Cafe", "Clean Retail" |
| preview_image_url | text | shown in the template picker |
| theme_identifier | text | maps to the actual frontend theme/component set used at render time |

### `business_microsites`
A business's deployed instance of a chosen template. One business can have at most one active microsite (v1).
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| business_id | uuid | FK → businesses |
| website_template_id | uuid | FK → website_templates |
| subdomain_slug | text, unique | builds the hosted URL `{slug}.ourdomain.com` |
| content | jsonb | logo_url, tagline, description, image_urls, contact_info — the only business-editable fields within the fixed template |
| featured_campaign_id | uuid, nullable | FK → campaigns — which campaign's public_join_slug/QR is embedded on the site |
| published | boolean | default false until business confirms |
| created_at / updated_at | timestamp | |

### `notification_templates` (global config, plan.md Phase 0.75)
Config-driven, like `category_pattern_weights` — adding a trigger or channel later is a new row, not new code.
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| trigger_type | enum | campaign_invite, ending_soon, reward_unlocked, submission_reviewed (v1's 4 triggers) |
| channel | enum | sms, telegram |
| body_template | text | supports placeholders, e.g. {{business_name}}, {{reward_description}} |

### `notifications_log`
One row per actual send attempt — audit trail + delivery status.
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| customer_campaign_code_id | uuid | FK → customer_campaign_codes |
| notification_template_id | uuid | FK → notification_templates |
| channel | enum | sms, telegram (denormalized copy for quick filtering) |
| status | enum | sent, failed, skipped (skipped = telegram attempted but customer not opted in) |
| provider_message_id | text, nullable | id returned by SMS gateway / Telegram Bot API, for delivery-status lookups |
| sent_at | timestamp | |

### `insights`
Generated insights (plan.md Phase 2).
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| campaign_id | uuid | FK → campaigns |
| cadence | enum | daily, weekly, anomaly |
| message | text | |
| suggested_action | text, nullable | e.g. "increase referral points to 80" |
| applied | boolean | tracks Phase 3 Apply-button state |
| created_at | timestamp | |

---

## Key relationships (summary)
```
businesses 1──* campaigns 1──* campaign_tasks *──1 task_patterns
                    │
                    ├──* campaign_rewards *──1 reward_patterns
                    │
                    └──* customer_campaign_codes *──1 customers
                              │
                              └──* task_submissions ──1:1── purchase_logs (when purchase-type)
                              │
                              └──* points_ledger
```

## Open implementation questions (not blocking, to resolve during build)
- [x] **Decided (2026-09-07):** business category moved from a hardcoded enum to a `business_categories` lookup table (see above). Adding a 7th+ category later is a plain row insert, no migration. `businesses.category_id`, `category_pattern_weights.business_category_id`, and `benchmark_stats.business_category_id` all FK into it; the 6 v1 categories are seed rows.
- [x] **Decided (2026-09-07):** AI screenshot review runs as a **separate microservice**, not inline in the main API. Main backend enqueues a review job when a submission comes in (`task_submissions.status = pending`); the review microservice processes it (calls the AI vision model) and writes back `ai_confidence_score` + the resulting status. Chosen so review load/latency and future AI-provider changes stay isolated from the main API, and so it fits naturally with the already-async pending→approved/rejected flow (plan.md). Needs a job queue between the two (mechanism TBD during build).
- [x] **Decided (2026-09-07):** added a dedicated `reward_redemptions` table (rather than just a bare field on points_ledger) to track reward claims, since redemptions need their own lifecycle (status: pending/fulfilled/cancelled), not just a point deduction. `points_ledger.reward_redemption_id` links the negative-points entry back to it.
