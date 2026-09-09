import { useState } from 'react'
import { Badge, Button, Card } from '@ai-campaign-builder/ui-kit'
import { micrositeState } from '../../lib/mock-data'

/**
 * Business microsite module toggles (plan.md "Business microsite scope") — modular sections,
 * AI-set display order, no reordering/free-form layout (owner can only enable/disable).
 * TODO: wire to PATCH /business_microsite_modules once backend exists.
 */
export function MicrositeBuilderTab() {
  const [modules, setModules] = useState(micrositeState.modules)

  const toggle = (key: string) =>
    setModules((prev) => prev.map((m) => (m.key === key ? { ...m, enabled: !m.enabled } : m)))

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">قالب: {micrositeState.templateName}</p>
          <p className="text-xs text-slate-500 mt-0.5" dir="ltr">
            {micrositeState.subdomainSlug}.ourdomain.com
          </p>
        </div>
        <Badge tone={micrositeState.published ? 'success' : 'neutral'}>
          {micrositeState.published ? 'منتشر شده' : 'پیش‌نویس'}
        </Badge>
      </Card>

      <div className="flex flex-col gap-2">
        {modules.map((m) => (
          <Card key={m.key} className="flex items-center justify-between p-3.5">
            <span className="text-sm">{m.labelFa}</span>
            <Button
              variant={m.enabled ? 'secondary' : 'ghost'}
              onClick={() => toggle(m.key)}
              aria-label={`${m.labelFa}: ${m.enabled ? 'فعال، کلیک برای غیرفعال کردن' : 'غیرفعال، کلیک برای فعال کردن'}`}
            >
              {m.enabled ? 'فعال' : 'غیرفعال'}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  )
}
