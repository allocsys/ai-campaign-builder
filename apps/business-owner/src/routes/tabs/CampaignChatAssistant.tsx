import { useRef, useState } from 'react'
import { Badge, Button, Card, useToast } from '@ai-campaign-builder/ui-kit'
import { sendCampaignChatMessage } from '@ai-campaign-builder/api-client'
import apiClient from '../../lib/api-client'

/**
 * plan.md Open Item 20 Part B -- the chat entry point for natural-language
 * campaign editing, decided to live inside CampaignEditorTab.tsx (the tab an
 * owner already goes to when they want to change something), not as its own
 * top-level tab and not bundled into InsightsAndSuggestionsTab. Rendered
 * regardless of "حالت حرفه‌ای" (pro mode) -- an NL request is a different way
 * to REACH a suggestion, independent of whether the owner also has manual
 * field-level editing access.
 *
 * One session id is generated once per mount (crypto.randomUUID()) and reused
 * for every message sent from this widget instance -- it's the key the
 * backend's Workers KV chat-history store (lib/chat-history.ts) uses to
 * thread a multi-turn clarification exchange together. It's intentionally
 * NOT persisted (no localStorage/sessionStorage -- see this repo's artifact
 * rules, and more fundamentally there's nothing to restore: KV's ~1hr TTL
 * means a reloaded page's "session" would usually be dead anyway). A page
 * reload starts a brand-new conversation, same as opening the widget for the
 * first time.
 *
 * A non-clarification result never appears inline as an apply/dismiss
 * action here -- per Part B's "one unified place changes get confirmed"
 * decision, the resulting suggestion only ever surfaces in SuggestionsTab.
 * This widget's own job stops at confirming the request was understood and
 * queued.
 */
export function CampaignChatAssistant() {
  const { show: showToast } = useToast()
  const sessionIdRef = useRef<string>(crypto.randomUUID())
  const [messages, setMessages] = useState<{ role: 'owner' | 'assistant'; content: string }[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return

    setMessages((prev) => [...prev, { role: 'owner', content: text }])
    setInput('')
    setSending(true)

    try {
      const result = await sendCampaignChatMessage(apiClient, { sessionId: sessionIdRef.current, text })
      if (result.needsClarification) {
        setMessages((prev) => [...prev, { role: 'assistant', content: result.clarifyingQuestion }])
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `پیشنهاد ثبت شد و به بخش «تحلیل و پیشنهاد» اضافه شد: ${result.suggestion.rationale}` },
        ])
        showToast('پیشنهاد جدید در بخش پیشنهادها منتظر تأیید شماست.', 'success')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setMessages((prev) => [...prev, { role: 'assistant', content: `خطا: ${msg}` }])
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter inserts a newline -- standard chat-input
    // convention, matches what an owner typing a multi-part request expects.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <Card className="p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-100">درخواست تغییر با متن</h3>
        <Badge tone="brand">دستیار هوشمند</Badge>
      </div>
      <p className="text-xs text-slate-400 -mt-1">
        هر تغییری که می‌خوای توی کمپینت اعمال بشه رو به زبان خودت بنویس -- مثلاً «امتیاز تسک اول رو بیشتر کن» یا «کمپین رو ۵ روز دیگه تمدید کن». دستیار در صورت نیاز یک سؤال روشن‌کننده می‌پرسه، در غیر این صورت پیشنهاد رو مستقیم به بخش «تحلیل و پیشنهاد» می‌فرسته تا تأیید یا رد کنی.
      </p>

      {messages.length > 0 && (
        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`text-sm rounded-xl2 px-3 py-2 max-w-[85%] ${
                m.role === 'owner'
                  ? 'self-end bg-brand-600/25 text-slate-100'
                  : 'self-start bg-glass-light border border-glass-border text-slate-200'
              }`}
            >
              {m.content}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
          rows={2}
          placeholder="مثلاً: آستانه اولین پاداش رو کمتر کن"
          className="flex-1 resize-none bg-glass-light backdrop-blur-md border border-glass-border rounded-xl2 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-brand-500/60 transition-shadow disabled:opacity-60"
        />
        <Button variant="primary" onClick={handleSend} loading={sending} disabled={!input.trim()}>
          ارسال
        </Button>
      </div>
    </Card>
  )
}
