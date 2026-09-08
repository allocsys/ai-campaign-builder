import { Badge, Button, Card, ToastProvider, useToast } from '@ai-campaign-builder/ui-kit'

function Placeholder() {
  const { show } = useToast()

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-md w-full p-8 text-center flex flex-col items-center gap-4">
        <Badge tone="brand">Step 2 — Shared UI Kit</Badge>
        <h1 className="text-2xl font-bold">پلتفرم کمپین‌ساز هوشمند</h1>
        <p className="text-slate-300 text-sm">
          اسکلت پروژه (Scaffold) با موفقیت راه‌اندازی شد — کتابخانه کامپوننت مشترک (ui-kit) هم متصل است.
        </p>
        <Button onClick={() => show('کتابخانه کامپوننت مشترک با موفقیت کار می‌کند ✅', 'success')}>
          تست Toast
        </Button>
      </Card>
    </div>
  )
}

function App() {
  return (
    <ToastProvider>
      <Placeholder />
    </ToastProvider>
  )
}

export default App
