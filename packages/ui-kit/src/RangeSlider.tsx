import { useEffect, useId, useState, type KeyboardEvent } from 'react'

export interface RangeSliderProps {
  label?: string
  helpText?: string
  min: number
  max: number
  step?: number
  valueMin: number
  valueMax: number
  onChange: (min: number, max: number) => void
  /** Formats a raw value for display next to the label, e.g. thousands separators or a "روزانه" suffix. */
  formatValue?: (value: number) => string
  className?: string
}

/**
 * Dual-handle range slider -- glass surface to match Input/Badge. ui-kit had
 * no range-slider primitive (plan.md, "Signal model revised again" entry,
 * 2026-09-12) -- same recurring component-gap pattern as Select's
 * selectClassName() workaround. Built from two overlapping native
 * <input type="range"> elements (a standard lightweight technique) rather
 * than hand-rolled pointer-drag logic, so each thumb keeps native
 * keyboard/a11y behavior for free. The scoped <style> block below is needed
 * because Tailwind utility classes can't target ::-webkit-slider-thumb /
 * ::-moz-range-thumb.
 *
 * IMPORTANT: the track wrapper below is forced to dir="ltr" even though the
 * app is RTL (bug found 2026-09-12, real deployed screenshot). Native
 * <input type="range"> mirrors itself under an inherited RTL direction --
 * min renders on the right, max on the left -- but the highlight-fill div's
 * left/right percentages are computed assuming plain LTR value->position
 * mapping. Left un-forced, the two thumbs visually mirror while the fill
 * bar doesn't, so the highlighted range and the actual thumbs end up
 * disconnected. Forcing dir="ltr" on just this inner wrapper (not the whole
 * app) stops the mirroring and re-aligns the fill with the thumbs, while
 * the label row above it stays in normal RTL flow.
 */
export function RangeSlider({
  label,
  helpText,
  min,
  max,
  step = 1,
  valueMin,
  valueMax,
  onChange,
  formatValue = (v) => String(v),
  className = '',
}: RangeSliderProps) {
  const id = useId()
  const pct = (v: number) => ((v - min) / (max - min)) * 100
  const minLabelId = `${id}-min`
  const maxLabelId = `${id}-max`

  // Local string state for the manual-entry inputs below the track, kept
  // separate from valueMin/valueMax so the field isn't clamped/reformatted
  // on every keystroke -- it only syncs back to the numeric prop (a) when
  // the slider itself changes valueMin/valueMax externally, or (b) when the
  // user commits their edit (blur / Enter), see commitMin/commitMax below.
  const [minInput, setMinInput] = useState(String(valueMin))
  const [maxInput, setMaxInput] = useState(String(valueMax))

  useEffect(() => {
    setMinInput(String(valueMin))
  }, [valueMin])
  useEffect(() => {
    setMaxInput(String(valueMax))
  }, [valueMax])

  function commitMin(raw: string) {
    const parsed = Number(raw)
    if (Number.isNaN(parsed)) {
      setMinInput(String(valueMin))
      return
    }
    const clamped = Math.min(Math.max(parsed, min), valueMax - step)
    setMinInput(String(clamped))
    onChange(clamped, valueMax)
  }

  function commitMax(raw: string) {
    const parsed = Number(raw)
    if (Number.isNaN(parsed)) {
      setMaxInput(String(valueMax))
      return
    }
    const clamped = Math.max(Math.min(parsed, max), valueMin + step)
    setMaxInput(String(clamped))
    onChange(valueMin, clamped)
  }

  function commitOnEnter(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') e.currentTarget.blur()
  }

  const manualInputClassName =
    'w-24 bg-glass-light backdrop-blur-md border border-glass-border rounded-xl2 px-2 py-1 text-xs text-slate-100 outline-none focus:ring-2 focus:ring-brand-500/60 transition-shadow'

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-300">{label}</span>
          <span className="text-xs text-brand-300 whitespace-nowrap" dir="ltr">
            {formatValue(valueMin)} – {formatValue(valueMax)}
          </span>
        </div>
      )}
      <div className="relative h-6 flex items-center" dir="ltr">
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-glass-light border border-glass-border" />
        <div
          className="absolute h-1.5 rounded-full bg-brand-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"
          style={{ left: `${pct(valueMin)}%`, right: `${100 - pct(valueMax)}%` }}
        />
        <input
          type="range"
          id={minLabelId}
          aria-label={label ? `${label} — کف` : 'کف بازه'}
          min={min}
          max={max}
          step={step}
          value={valueMin}
          onChange={(e) => {
            const next = Math.min(Number(e.target.value), valueMax - step)
            onChange(next, valueMax)
          }}
          className="ui-kit-range-thumb absolute inset-x-0 w-full appearance-none bg-transparent"
        />
        <input
          type="range"
          id={maxLabelId}
          aria-label={label ? `${label} — سقف` : 'سقف بازه'}
          min={min}
          max={max}
          step={step}
          value={valueMax}
          onChange={(e) => {
            const next = Math.max(Number(e.target.value), valueMin + step)
            onChange(valueMin, next)
          }}
          className="ui-kit-range-thumb absolute inset-x-0 w-full appearance-none bg-transparent"
        />
      </div>
      <div className="flex items-center gap-3" dir="ltr">
        <label className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="whitespace-nowrap">کف</span>
          <input
            type="number"
            inputMode="numeric"
            value={minInput}
            min={min}
            max={valueMax - step}
            step={step}
            onChange={(e) => setMinInput(e.target.value)}
            onBlur={(e) => commitMin(e.target.value)}
            onKeyDown={commitOnEnter}
            className={manualInputClassName}
            aria-label={label ? `${label} — کف (ورود دستی)` : 'کف بازه (ورود دستی)'}
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="whitespace-nowrap">سقف</span>
          <input
            type="number"
            inputMode="numeric"
            value={maxInput}
            min={valueMin + step}
            max={max}
            step={step}
            onChange={(e) => setMaxInput(e.target.value)}
            onBlur={(e) => commitMax(e.target.value)}
            onKeyDown={commitOnEnter}
            className={manualInputClassName}
            aria-label={label ? `${label} — سقف (ورود دستی)` : 'سقف بازه (ورود دستی)'}
          />
        </label>
      </div>
      {helpText && <p className="text-xs text-slate-500">{helpText}</p>}
      <style>{`
        .ui-kit-range-thumb {
          pointer-events: none;
          margin: 0;
        }
        .ui-kit-range-thumb::-webkit-slider-runnable-track {
          background: transparent;
        }
        .ui-kit-range-thumb::-moz-range-track {
          background: transparent;
        }
        .ui-kit-range-thumb::-webkit-slider-thumb {
          pointer-events: auto;
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 9999px;
          background: #fff;
          border: 3px solid rgb(99 102 241);
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
          cursor: pointer;
        }
        .ui-kit-range-thumb::-moz-range-thumb {
          pointer-events: auto;
          width: 20px;
          height: 20px;
          border-radius: 9999px;
          background: #fff;
          border: 3px solid rgb(99 102 241);
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
          cursor: pointer;
        }
      `}</style>
    </div>
  )
}
