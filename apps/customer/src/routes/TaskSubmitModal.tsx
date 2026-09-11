import { useState } from 'react'
import { Button, Modal, useToast } from '@ai-campaign-builder/ui-kit'
import type { CustomerTask } from '@ai-campaign-builder/api-client'
import { uploadEvidence, ApiError } from '@ai-campaign-builder/api-client'
import apiClient from '../lib/api-client'

interface TaskSubmitModalProps {
  task: CustomerTask | null
  onClose: () => void
  onSubmit: (evidenceUrl: string) => void
}

const ACCEPTED_MIME_TYPES = 'image/jpeg,image/png,image/webp'

/**
 * Evidence upload modal for screenshot_ai-verified tasks (mirrors mockup/customer.html's
 * #task-submit-modal). Uploads the real file to B2 via POST /api/customer/evidence-upload
 * (apps/backend/src/lib/storage.ts) before handing the resulting evidenceUrl back to the
 * caller -- two round trips (upload, then the actual /submit call in CustomerHome.tsx) by
 * design, so a failed upload never gets bundled into a task submission with a broken URL.
 */
export function TaskSubmitModal({ task, onClose, onSubmit }: TaskSubmitModalProps) {
  const { show } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const handleClose = () => {
    setFile(null)
    setUploading(false)
    onClose()
  }

  const handleSubmit = async () => {
    if (!file) return
    setUploading(true)
    try {
      const { evidenceUrl } = await uploadEvidence(apiClient, file)
      onSubmit(evidenceUrl)
      setFile(null)
    } catch (err) {
      // Distinguish "storage not configured yet" (503, an ops-side gap, not
      // the customer's fault) from a real upload failure -- same
      // not-configured/real-failure split routes/customer.ts's error
      // handling draws server-side.
      if (err instanceof ApiError && err.status === 503) {
        show('آپلود مدرک در حال حاضر فعال نیست. لطفاً بعداً تلاش کنید.', 'danger')
      } else {
        show(err instanceof Error ? err.message : 'خطا در آپلود مدرک', 'danger')
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <Modal open={!!task} onClose={handleClose} title="ارسال مدرک برای بررسی هوش مصنوعی">
      {task && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-300">{task.title}</p>
          <label className="border-2 border-dashed border-glass-border rounded-xl2 p-6 text-center cursor-pointer hover:bg-white/5 transition-colors">
            <input
              type="file"
              accept={ACCEPTED_MIME_TYPES}
              className="hidden"
              disabled={uploading}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <span className="block text-2xl mb-1" aria-hidden="true">📷</span>
            <span className="text-sm text-slate-400">
              {file ? `فایل انتخاب شد: ${file.name}` : 'کلیک برای انتخاب عکس یا اسکرین‌شات'}
            </span>
          </label>
          <p className="text-xs text-slate-500">سیستم بینایی هوش مصنوعی کد اختصاصی شما و تصویر کافه را در عکس بررسی می‌کند.</p>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={handleClose} disabled={uploading}>
              انصراف
            </Button>
            <Button onClick={handleSubmit} disabled={!file || uploading}>
              {uploading ? 'در حال آپلود...' : 'ارسال برای بررسی AI'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
