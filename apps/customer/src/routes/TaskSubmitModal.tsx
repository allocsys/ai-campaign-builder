import { useState } from 'react'
import { Button, Modal } from '@ai-campaign-builder/ui-kit'
import type { CustomerTask } from '@ai-campaign-builder/api-client'

interface TaskSubmitModalProps {
  task: CustomerTask | null
  onClose: () => void
  onSubmit: () => void
}

/**
 * Evidence upload modal for screenshot_ai-verified tasks (mirrors mockup/customer.html's
 * #task-submit-modal). No real file upload yet — just a filename placeholder, matching
 * the mockup's simulated-file convention. TODO: wire to real upload once file storage exists.
 */
export function TaskSubmitModal({ task, onClose, onSubmit }: TaskSubmitModalProps) {
  const [fileName, setFileName] = useState<string | null>(null)

  return (
    <Modal open={!!task} onClose={onClose} title="ارسال مدرک برای بررسی هوش مصنوعی">
      {task && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-300">{task.title}</p>
          <label className="border-2 border-dashed border-glass-border rounded-xl2 p-6 text-center cursor-pointer hover:bg-white/5 transition-colors">
            <input
              type="file"
              className="hidden"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            />
            <span className="block text-2xl mb-1" aria-hidden="true">📷</span>
            <span className="text-sm text-slate-400">
              {fileName ? `فایل انتخاب شد: ${fileName}` : 'کلیک برای انتخاب فایل شبیه‌سازی'}
            </span>
          </label>
          <p className="text-xs text-slate-500">سیستم بینایی هوش مصنوعی کد اختصاصی شما و تصویر کافه را در عکس بررسی می‌کند.</p>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={onClose}>
              انصراف
            </Button>
            <Button onClick={onSubmit}>ارسال برای بررسی AI</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
