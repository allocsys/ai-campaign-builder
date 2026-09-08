/**
 * AI Campaign Builder - In-memory Seed Mock Data
 * Loosely mirrors architecture.md entities
 */

window.MOCK = (function () {
  const businessCategories = [
    {
      id: "cat_coffee",
      slug: "coffee_shop",
      name_fa: "کافی‌شاپ / کافه",
      conditional_question: "مشتری بیشتر حضوریه یا آنلاین/دلیوری؟",
      conditional_options: ["اکثراً حضوری در سالن", "سفارش بیرون‌بر و اسنپ‌فود", "ترکیبی متوازن"]
    },
    {
      id: "cat_clothing",
      slug: "clothing",
      name_fa: "فروشگاه لباس / پوشاک",
      conditional_question: "فروش فصلی داری یا کالای همیشگی؟",
      conditional_options: ["فروش فصلی و کالکشن‌های دوره‌ای", "کالکشن ثابت و همیشگی", "هر دو مدل"]
    },
    {
      id: "cat_restaurant",
      slug: "restaurant",
      name_fa: "رستوران / فست‌فود",
      conditional_question: "تمرکز روی سفارش مجدد یا تجربه حضوری؟",
      conditional_options: ["تجربه حضوری و دورهمی", "سفارش‌های مجدد بیرون‌بر", "هر دو"]
    },
    {
      id: "cat_online",
      slug: "online_store",
      name_fa: "فروشگاه آنلاین (غیر پوشاک)",
      conditional_question: "چرخه خرید تکراریه یا یک‌بار مصرف؟",
      conditional_options: ["خرید تکراری و مصرفی", "خرید بادوام و کم‌تکرار", "متوسط"]
    },
    {
      id: "cat_gym",
      slug: "gym",
      name_fa: "باشگاه / سالن ورزشی",
      conditional_question: "هدف نگه‌داشتن مشتری قدیمیه یا جذب جدید؟",
      conditional_options: ["تمدید اشتراک مشتریان قبلی", "جذب ورزشکاران و اعضای جدید", "هر دو به یک اندازه"]
    },
    {
      id: "cat_beauty",
      slug: "beauty_clinic",
      name_fa: "کلینیک زیبایی",
      conditional_question: "خدمات یک‌باره یا پکیج/دوره‌ای؟",
      conditional_options: ["پکیج‌های چندجلسه‌ای و دوره‌ای", "خدمات تک‌جلسه‌ای و موردی", "ترکیبی"]
    }
  ];

  // Business size-tier dynamic scaling configuration (plan.md / architecture.md)
  const sizeTierConfig = {
    tiers: [
      { key: "micro", name_fa: "میکرو (Micro)", maxFollowers: 500, maxBudgetToman: 30000, pointMultiplier: 0.7, suggestedDurationDays: 10 },
      { key: "small", name_fa: "کوچک (Small)", maxFollowers: 2000, maxBudgetToman: 100000, pointMultiplier: 1.0, suggestedDurationDays: 14 },
      { key: "medium", name_fa: "متوسط (Medium)", maxFollowers: 20000, maxBudgetToman: 500000, pointMultiplier: 1.5, suggestedDurationDays: 21 },
      { key: "large", name_fa: "بزرگ (Large)", maxFollowers: Infinity, maxBudgetToman: Infinity, pointMultiplier: 2.0, suggestedDurationDays: 30 }
    ],
    // Weighting table for Phase 1 Abstraction Layer (0 to 3)
    patternWeights: {
      coffee_shop: { social_proof: 3, referral: 2, repeat_purchase: 2, milestone_streak: 1, specific_product_push: 3, review_ugc: 1, first_action: 2, off_peak: 2, anniversary_birthday: 1 },
      clothing: { social_proof: 2, referral: 2, repeat_purchase: 2, milestone_streak: 0, specific_product_push: 1, review_ugc: 1, first_action: 2, off_peak: 0, anniversary_birthday: 2 },
      restaurant: { social_proof: 2, referral: 2, repeat_purchase: 3, milestone_streak: 0, specific_product_push: 2, review_ugc: 2, first_action: 2, off_peak: 2, anniversary_birthday: 1 },
      online_store: { social_proof: 1, referral: 2, repeat_purchase: 2, milestone_streak: 0, specific_product_push: 1, review_ugc: 3, first_action: 3, off_peak: 0, anniversary_birthday: 1 },
      gym: { social_proof: 1, referral: 2, repeat_purchase: 0, milestone_streak: 3, specific_product_push: 0, review_ugc: 1, first_action: 2, off_peak: 2, anniversary_birthday: 2 },
      beauty_clinic: { social_proof: 3, referral: 2, repeat_purchase: 1, milestone_streak: 1, specific_product_push: 0, review_ugc: 2, first_action: 2, off_peak: 1, anniversary_birthday: 2 }
    }
  };

  const businesses = [
    {
      id: "b_narvan",
      name: "کافه نارون",
      category_id: "cat_coffee",
      phone: "09121111111",
      phone_verified: true,
      sms_wallet_balance_toman: 420000,
      sms_monthly_cap_toman: 600000,
      instagram_handle: "narvan_cafe",
      follower_count: 1450,
      offer_budget_toman: 85000,
      autopilot_enabled: false,
      size_tier: "small",
      created_at: "1403/06/15"
    },
    {
      id: "b_sarina",
      name: "بوتیک سارینا",
      category_id: "cat_clothing",
      phone: "09122222222",
      phone_verified: true,
      sms_wallet_balance_toman: 950000,
      sms_monthly_cap_toman: 1200000,
      instagram_handle: "sarina_boutique",
      follower_count: 8500,
      offer_budget_toman: 250000,
      autopilot_enabled: false,
      size_tier: "medium",
      created_at: "1403/06/18"
    },
    {
      id: "b_energy",
      name: "باشگاه انرژی",
      category_id: "cat_gym",
      phone: "09123333333",
      phone_verified: true,
      sms_wallet_balance_toman: 1800000,
      sms_monthly_cap_toman: 2000000,
      instagram_handle: "energy_gym_tehran",
      follower_count: 24000,
      offer_budget_toman: 600000,
      autopilot_enabled: false,
      size_tier: "large",
      created_at: "1403/05/20"
    }
  ];

  // SMS wallet pricing + transaction audit trail (Phase 0.9 "SMS cost control", architecture.md sms_pricing / sms_wallet_transactions)
  const smsPricing = {
    price_per_sms_toman: 350,
    effective_from: "1403/01/01"
  };

  const smsWalletTransactions = [
    {
      id: "txn_seed_1",
      business_id: "b_narvan",
      type: "topup",
      amount_toman: 500000,
      notification_log_id: null,
      balance_after_toman: 500000,
      created_at: "1403/07/01"
    },
    {
      id: "txn_seed_2",
      business_id: "b_narvan",
      type: "deduction",
      amount_toman: -80000,
      notification_log_id: null,
      balance_after_toman: 420000,
      created_at: "1403/07/03"
    }
  ];

  const businessAiConstraints = {
    b_narvan: {
      business_id: "b_narvan",
      max_discount_percent: 25,
      budget_ceiling_toman: 150000,
      updated_at: "1403/07/01"
    }
  };

  const checklistItems = [
    {
      item_key: "ai_constraints_saved",
      label_fa: "بررسی و تنظیم خطوط قرمز هوش مصنوعی",
      description_fa: "سقف تخفیف و بودجه پاداش رو در تب «تنظیمات» مشخص کن تا پیشنهادهای AI همیشه در همون چارچوب بمونن.",
      cta_label: "برو به تنظیمات",
      cta_type: "tab",
      cta_target: "settings-view"
    },
    {
      item_key: "contacts_imported",
      label_fa: "وارد کردن مخاطبین اولیه",
      description_fa: "لیست مشتری‌های قبلی رو آپلود کن، یا صبر کن اولین نفر از طریق لینک عمومی کمپین خودش عضو بشه.",
      cta_label: "بارگذاری نمایشی CSV",
      cta_type: "action",
      cta_target: "simulateContactImport"
    }
  ];

  const businessChecklistProgress = {
    b_narvan: {
      ai_constraints_saved: null,
      contacts_imported: null
    }
  };

  // Point expiry & carryover (plan.md Phase 0.5 "Point expiry & carryover", architecture.md point_carryovers)
  // Empty at seed — populated at runtime when the business owner simulates a campaign's grace-period end.
  const pointCarryovers = [];

  const businessContacts = [
    {
      id: "contact_1",
      business_id: "b_narvan",
      phone_number: "09121112233",
      source: "manual_upload",
      imported_at: "1403/07/01"
    },
    {
      id: "contact_2",
      business_id: "b_narvan",
      phone_number: "09123334455",
      source: "manual_upload",
      imported_at: "1403/07/02"
    }
  ];

  const campaigns = [
    {
      id: "c_narvan_autumn",
      business_id: "b_narvan",
      name: "کمپین وفاداری پاییزه کافه نارون",
      goal: "acquisition",
      audience_description: "دانشجویان و جوانان اهل قهوه در محدوده ولیعصر",
      offer_description: "یک نوشیدنی گرم مهمان ما به ازای اولین خرید یا معرفی دوست",
      status: "active",
      point_multiplier: 1.0,
      duration_days: 14,
      start_date: "1403/07/01",
      end_date: "1403/07/15",
      public_join_slug: "narvan-autumn",
      max_referrals_per_customer: 10,
      grace_period_days: 2,
      carryover_percentage: 30,
      challenge: {
        title: "چالش هفتگی کافه‌گردی",
        description: "انجام ۳ فعالیت مختلف در ۷ روز",
        bonus_points: 150,
        badge: "نشان کافه‌باز حرفه‌ای"
      },
      stats: {
        total_members: 148,
        active_participants: 94,
        points_awarded_total: 19450,
        rewards_fulfilled: 31,
        conversion_rate: "24.5%"
      }
    }
  ];

  const taskPatterns = [
    { id: "tp_social", name: "social_proof", name_fa: "استوری و شبکه‌های اجتماعی", verification_method: "screenshot_ai", base_points: 50 },
    { id: "tp_referral", name: "referral", name_fa: "دعوت از دوستان", verification_method: "code_link_auto", base_points: 80 },
    { id: "tp_repeat", name: "repeat_purchase", name_fa: "سفارش مجدد", verification_method: "pos_scan", base_points: 40 },
    { id: "tp_product", name: "specific_product_push", name_fa: "امتحان محصول خاص (قهوه دمی)", verification_method: "pos_scan", base_points: 35 },
    { id: "tp_first", name: "first_action", name_fa: "اولین خرید حضوری", verification_method: "pos_scan", base_points: 60 },
    { id: "tp_offpeak", name: "off_peak", name_fa: "سفارش در ساعت خلوت (۱۵ تا ۱۷)", verification_method: "pos_scan", base_points: 45 },
    { id: "tp_review", name: "review_ugc", name_fa: "ثبت نظر در گوگل‌مپ یا نشان", verification_method: "screenshot_ai", base_points: 70 },
    { id: "tp_streak", name: "milestone_streak", name_fa: "۳ روز مراجعه متوالی", verification_method: "pos_scan", base_points: 100 },
    { id: "tp_birthday", name: "anniversary_birthday", name_fa: "ثبت تاریخ تولد و خرید در هفته تولد", verification_method: "code_link_auto", base_points: 50 }
  ];

  const campaignTasks = [
    {
      id: "ct_1",
      campaign_id: "c_narvan_autumn",
      task_pattern_id: "tp_social",
      title: "استوری اینستاگرام از کافه با ذکر کد اختصاصی شما",
      verification_method: "screenshot_ai",
      points_value: 50,
      display_order: 1,
      instruction: "عکس یا استوری خود را منتشر کرده، کد شخصی خود را در متن قرار دهید و اسکرین‌شات را ارسال کنید."
    },
    {
      id: "ct_2",
      campaign_id: "c_narvan_autumn",
      task_pattern_id: "tp_referral",
      title: "دعوت از دوست با لینک اختصاصی شما",
      verification_method: "code_link_auto",
      points_value: 80,
      display_order: 2,
      instruction: "دوست شما با کد ثبت‌نام کند و اولین خرید خود را در کافه ثبت نماید."
    },
    {
      id: "ct_3",
      campaign_id: "c_narvan_autumn",
      task_pattern_id: "tp_first",
      title: "ثبت اولین خرید حضوری در صندوق کافه",
      verification_method: "pos_scan",
      points_value: 60,
      display_order: 3,
      instruction: "هنگام پرداخت، بارکد یا کد ۵ رقمی خود را به صندوق‌دار نشان دهید."
    },
    {
      id: "ct_4",
      campaign_id: "c_narvan_autumn",
      task_pattern_id: "tp_offpeak",
      title: "مراجعه در ساعات خلوت (۱۵ تا ۱۷ عصر)",
      verification_method: "pos_scan",
      points_value: 45,
      display_order: 4,
      instruction: "در بازه ساعت ۱۵:۰۰ تا ۱۷:۰۰ سفارش ثبت کنید و امتیاز ویژه دریافت کنید."
    }
  ];

  const campaignRewards = [
    {
      id: "cr_1",
      campaign_id: "c_narvan_autumn",
      threshold_points: 120,
      reward_pattern: "free_item",
      title: "یک فنجان قهوه گرم انتخابی رایگان",
      description: "آمریکانو یا کاپوچینو مهمان کافه نارون",
      available_count: 50
    },
    {
      id: "cr_2",
      campaign_id: "c_narvan_autumn",
      threshold_points: 220,
      reward_pattern: "percentage_discount",
      title: "۲۰٪ تخفیف کل فاکتور",
      description: "قابل استفاده برای سفارش‌های تا سقف ۵۰۰ هزار تومان",
      available_count: 30
    },
    {
      id: "cr_3",
      campaign_id: "c_narvan_autumn",
      threshold_points: 380,
      reward_pattern: "promo_item",
      title: "بسته ۲۵۰ گرمی دانه قهوه تخصصی + ماگ نارون",
      description: "هدیه اختصاصی برای اعضای طلایی باشگاه مشتریان",
      available_count: 10
    }
  ];

  const customers = [
    {
      id: "cust_1",
      phone_number: "09129990001",
      name: "سارا احمدی",
      phone_verified: true,
      telegram_opted_in: true,
      telegram_chat_id: "sara_ah"
    },
    {
      id: "cust_2",
      phone_number: "09129990002",
      name: "علی رضایی",
      phone_verified: true,
      telegram_opted_in: false,
      telegram_chat_id: null
    },
    {
      id: "cust_3",
      phone_number: "09129990003",
      name: "نیما محمدی",
      phone_verified: true,
      telegram_opted_in: true,
      telegram_chat_id: "nima_m"
    }
  ];

  const customerCampaignCodes = [
    {
      id: "code_cust_1",
      customer_id: "cust_1",
      campaign_id: "c_narvan_autumn",
      personal_code: "48291",
      qr_payload: "CAMP-NARVAN-48291",
      points_balance: 190,
      carryover_bonus: 30,
      referral_count: 2
    },
    {
      id: "code_cust_2",
      customer_id: "cust_2",
      campaign_id: "c_narvan_autumn",
      personal_code: "71934",
      qr_payload: "CAMP-NARVAN-71934",
      points_balance: 110,
      carryover_bonus: 0,
      referral_count: 0
    },
    {
      id: "code_cust_3",
      customer_id: "cust_3",
      campaign_id: "c_narvan_autumn",
      personal_code: "33812",
      qr_payload: "CAMP-NARVAN-33812",
      points_balance: 310,
      carryover_bonus: 0,
      referral_count: 3
    }
  ];

  const taskSubmissions = [
    {
      id: "sub_1",
      customer_campaign_code_id: "code_cust_1",
      campaign_task_id: "ct_1",
      customer_name: "سارا احمدی",
      task_title: "استوری اینستاگرام",
      submission_type: "screenshot",
      evidence_url: "story_sara_48291.jpg",
      ai_confidence_score: 94,
      status: "approved",
      reviewed_by: "ai",
      points_awarded: 50,
      submitted_at: "۱۴۰۳/۰۷/۰۳ ۱۴:۲۰"
    },
    {
      id: "sub_2",
      customer_campaign_code_id: "code_cust_2",
      campaign_task_id: "ct_1",
      customer_name: "علی رضایی",
      task_title: "استوری اینستاگرام",
      submission_type: "screenshot",
      evidence_url: "story_ali_blurry.jpg",
      ai_confidence_score: 56,
      status: "pending",
      reviewed_by: null,
      notes: "کد ۴ رقمی داخل تصویر محو است و نیازمند بررسی چشمی توسط تیم مرکزی می‌باشد.",
      points_awarded: null,
      submitted_at: "۱۴۰۳/۰۷/۰۵ ۱۸:۴۵"
    },
    {
      id: "sub_3",
      customer_campaign_code_id: "code_cust_3",
      campaign_task_id: "ct_1",
      customer_name: "نیما محمدی",
      task_title: "استوری اینستاگرام",
      submission_type: "screenshot",
      evidence_url: "receipt_wrong_shop.jpg",
      ai_confidence_score: 22,
      status: "rejected",
      reviewed_by: "ai",
      rejection_reason: "تصویر ارسال شده با کافه نارون یا کد کاربری مطابقت ندارد.",
      points_awarded: 0,
      submitted_at: "۱۴۰۳/۰۷/۰۴ ۱۰:۱۵"
    }
  ];

  const insights = [
    {
      id: "ins_1",
      campaign_id: "c_narvan_autumn",
      cadence: "daily",
      badge_fa: "گزارش روزانه",
      message: "نرخ تکمیل استوری منشن در ۲۴ ساعت گذشته ۱۲٪ بوده که از میانگین صنف کافه‌ها (۲۶٪) کمتر است.",
      suggested_action: "پیشنهاد افزایش امتیاز تسک استوری به ۷۰ جهت افزایش رغبت اعضا."
    },
    {
      id: "ins_2",
      campaign_id: "c_narvan_autumn",
      cadence: "weekly",
      badge_fa: "تحلیل هفتگی",
      message: "مشتریان وارد شده از طریق دعوت دوستان (Referral) ۲.۴ برابر بیشتر از سایرین خرید حضوری تکراری ثبت کرده‌اند.",
      suggested_action: "تمرکز بر پاداش‌های معرفی با کاهش آستانه پاداش سطح اول."
    },
    {
      id: "ins_3",
      campaign_id: "c_narvan_autumn",
      cadence: "anomaly",
      badge_fa: "هشدار رفتار غیرعادی",
      message: "افزایش ناگهانی ۶۵٪ در ثبت کدهای معرف طی بازه زمانی ۱۴ تا ۱۶ عصر دیروز شناسایی شد.",
      suggested_action: "بررسی الگو توسط سیستم ضدتقلب جهت اطمینان از خریدهای معتبر."
    }
  ];

  const suggestedChanges = [
    {
      id: "sc_1",
      campaign_id: "c_narvan_autumn",
      risk_tier: "low",
      change_type: "task_points",
      title: "افزایش امتیاز تسک استوری منشن",
      current_value: { points: 50, task_id: "ct_1" },
      suggested_value: { points: 70 },
      rationale: "به دلیل پایین بودن نرخ تکمیل (۱۲٪ در مقایسه با بنچمارک ۲۶٪)، افزایش ۲۰ امتیازی می‌تواند انگیزه کاربران را ۳۰٪ افزایش دهد.",
      status: "pending",
      applied_by: null
    },
    {
      id: "sc_2",
      campaign_id: "c_narvan_autumn",
      risk_tier: "low",
      change_type: "reward_threshold",
      title: "کاهش آستانه پاداش فنجان قهوه رایگان",
      current_value: { threshold: 120, reward_id: "cr_1" },
      suggested_value: { threshold: 100 },
      rationale: "رسیدن سریع‌تر مشتریان به اولین جایزه، نرخ ریزش هفته اول را به میزان ۴۲٪ کاهش می‌دهد.",
      status: "pending",
      applied_by: null
    },
    {
      id: "sc_3",
      campaign_id: "c_narvan_autumn",
      risk_tier: "low",
      change_type: "campaign_duration",
      title: "تمدید مدت کمپین به مدت ۷ روز دیگر",
      current_value: { duration_days: 14 },
      suggested_value: { duration_days: 21 },
      rationale: "با توجه به شتاب ثبت‌نام در روزهای اخیر، تمدید کمپین تا پایان ماه باعث جذب حدود ۵۰ مشتری وفادار جدید خواهد شد.",
      status: "pending",
      applied_by: null
    },
    {
      id: "sc_4",
      campaign_id: "c_narvan_autumn",
      risk_tier: "high",
      change_type: "reward_depth",
      title: "افزایش تخفیف فاکتور از ۲۰٪ به ۳۰٪",
      current_value: { discount_percent: 20, reward_id: "cr_2" },
      suggested_value: { discount_percent: 30 },
      rationale: "هشدار مالی: این تغییر مستقیماً بر حاشیه سود اثرگذار است. پیشنهاد شده برای رقابت با جشنواره پاییزه رقبا، اما نیازمند تایید دقیق است.",
      status: "pending",
      applied_by: null
    }
  ];

  const referralFlags = [
    {
      id: "rf_1",
      referrer_name: "امیرحسین کریمی (09129990008)",
      rule_triggered: "velocity",
      rule_name_fa: "تعداد دعوت نامتعارف در بازه کوتاه (Velocity)",
      description: "۸ ثبت‌نام موفق با این کد معرف در کمتر از ۲۴ ساعت ثبت شده است (سقف مجاز سیستم ۵ است).",
      triggered_at: "۱۴۰۳/۰۷/۰۸ ۱۱:۳۰",
      status: "open",
      notes: ""
    },
    {
      id: "rf_2",
      referrer_name: "مهدی پاکزاد (09351114444)",
      rule_triggered: "dead_referral_ratio",
      rule_name_fa: "دعوت‌های غیرفعال بدون خرید (Dead Referral Ratio)",
      description: "۶ کاربر دعوت شده بیش از ۷ روز است ثبت‌نام کرده‌اند اما هیچ خرید یا فعالیتی در صندوق ثبت نکرده‌اند.",
      triggered_at: "۱۴۰۳/۰۷/۰۷ ۱۶:۴۵",
      status: "open",
      notes: ""
    },
    {
      id: "rf_3",
      referrer_name: "رویا شمس (09198882211)",
      rule_triggered: "velocity",
      rule_name_fa: "تعداد دعوت نامتعارف در بازه کوتاه (Velocity)",
      description: "۶ ثبت‌نام در ۱۲ ساعت انجام شده بود.",
      triggered_at: "۱۴۰۳/۰۷/۰۵ ۰۹:۱۵",
      status: "reviewed",
      notes: "بررسی شد: ایشان از طریق استوری اینستاگرام پیج دانشجویی دعوت کرده‌اند و ۳ نفر خرید حضوری داشته‌اند. معتبر است."
    }
  ];

  const websiteTemplates = [
    {
      id: "wt_cafe",
      name: "کافه دنج (Minimal Cafe)",
      category_slug: "coffee_shop",
      description: "طراحی گرم، صمیمی با تمرکز بر منوی نوشیدنی‌ها و فضاهای دنج",
      theme: "warm-amber",
      preview_badge: "پیشنهاد AI برای کافه‌ها"
    },
    {
      id: "wt_boutique",
      name: "استایل مدرن (Clean Boutique)",
      category_slug: "clothing",
      description: "حالت گالری عکس بزرگ، رنگ‌های خنثی و کالکشن‌های فصلی",
      theme: "chic-stone",
      preview_badge: "پیشنهاد AI برای پوشاک"
    },
    {
      id: "wt_gourmet",
      name: "مزه اصیل (Gourmet Dining)",
      category_slug: "restaurant",
      description: "منوی غذا همراه با جزییات، رزرو میز و تصاویر باکیفیت",
      theme: "deep-slate",
      preview_badge: "پیشنهاد AI برای رستوران"
    },
    {
      id: "wt_power",
      name: "انرژی و حرکت (Dynamic Gym)",
      category_slug: "gym",
      description: "رنگ‌بندی جسورانه، معرفی مربیان و جدول برنامه‌های هفتگی",
      theme: "neon-energy",
      preview_badge: "پیشنهاد AI برای باشگاه"
    }
  ];

  const websiteModules = [
    { key: "hero", name_fa: "بخش سربرگ و معرفی کوتاه (Hero)", default_coffee: true },
    { key: "campaign_highlight", name_fa: "بخش ویژه کمپین و دریافت کد هدیه (Campaign Highlight)", default_coffee: true },
    { key: "about", name_fa: "درباره ما و داستان برند (About)", default_coffee: true },
    { key: "product_menu", name_fa: "منوی محبوب‌ترین اقلام و قیمت‌ها (Menu / Products)", default_coffee: true },
    { key: "gallery", name_fa: "گالری تصاویر فضای کافه (Photo Gallery)", default_coffee: true },
    { key: "testimonials", name_fa: "نظرات مشتریان وفادار (Testimonials)", default_coffee: false },
    { key: "booking_cta", name_fa: "دکمه رزرو میز یا وقت قبلی (Booking CTA)", default_coffee: false },
    { key: "contact", name_fa: "اطلاعات تماس، لوکیشن و ساعات کاری (Contact)", default_coffee: true }
  ];

  const notificationsLog = [
    {
      id: "notif_1",
      business_id: "b_narvan",
      customer_campaign_code_id: "code_cust_1",
      business_contact_id: null,
      campaign_id: null,
      customer: "سارا احمدی (09129990001)",
      channel: "sms",
      trigger: "submission_reviewed",
      text: "سارا احمدی عزیز! عکس استوری شما تایید شد و ۵۰ امتیاز به حساب باشگاه مشتریان کافه نارون واریز شد.",
      time: "۱۰ دقیقه پیش",
      status: "sent"
    },
    {
      id: "notif_2",
      business_id: "b_narvan",
      customer_campaign_code_id: "code_cust_1",
      business_contact_id: null,
      campaign_id: null,
      customer: "سارا احمدی (09129990001)",
      channel: "telegram",
      trigger: "reward_unlocked",
      text: "تبریک 🎉 شما امتیاز کافی برای دریافت «یک فنجان قهوه گرم رایگان» را کسب کردید!",
      time: "۸ دقیقه پیش",
      status: "sent"
    },
    {
      id: "notif_3",
      business_id: "b_narvan",
      customer_campaign_code_id: null,
      business_contact_id: "contact_1",
      campaign_id: "c_narvan_autumn",
      customer: "09121112233",
      channel: "sms",
      trigger: "campaign_invite",
      text: "علی عزیز، به کمپین پاییزه کافه نارون خوش آمدید! کد شخصی شما: 71934",
      time: "۲ روز پیش",
      status: "sent"
    }
  ];

  return {
    businessCategories,
    sizeTierConfig,
    smsPricing,
    smsWalletTransactions,
    businesses,
    businessAiConstraints,
    checklistItems,
    businessChecklistProgress,
    businessContacts,
    campaigns,
    taskPatterns,
    campaignTasks,
    campaignRewards,
    customers,
    customerCampaignCodes,
    taskSubmissions,
    insights,
    suggestedChanges,
    referralFlags,
    websiteTemplates,
    websiteModules,
    notificationsLog
  };
})();
