import { motion } from 'framer-motion'

function App() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="glass-panel max-w-md w-full p-8 text-center"
      >
        <h1 className="text-2xl font-bold mb-2">پلتفرم کمپین‌ساز هوشمند</h1>
        <p className="text-slate-300 text-sm">
          اسکلت پروژه (Scaffold) با موفقیت راه‌اندازی شد — React + Vite + Tailwind + Framer Motion آماده است.
        </p>
      </motion.div>
    </div>
  )
}

export default App
