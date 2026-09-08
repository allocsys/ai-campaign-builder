import { Badge, Card } from '@ai-campaign-builder/ui-kit'

/** Placeholder landing screen post-login. Real dashboard content is Phase 5 Step 4. */
export function Dashboard() {
  return (
    <div className="max-w-2xl mx-auto">
      <Card className="p-8 text-center flex flex-col items-center gap-3">
        <Badge tone="brand">Step 3 — Routing + Auth Shell</Badge>
        <h1 className="text-xl font-bold">ورود با موفقیت انجام شد 🎉</h1>
        <p className="text-slate-300 text-sm">
          مسیر احراز هویت (شماره موبایل + کد تایید) و پوسته اصلی برنامه آماده است. داشبورد واقعی در مرحله بعد ساخته
          می‌شود.
        </p>
      </Card>
    </div>
  )
}
