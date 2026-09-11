import { useId } from 'react'

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

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-300">{label}</span>
          <span className="text-xs text-brand-300 whitespace-nowrap">
            {formatValue(valueMin)} – {formatValue(valueMax)}
          </span>
        </div>
      )}
      <div className="relative h-6 flex items-center">
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-glass-light border border-glass-border" />
        <div
          className="absolute h-1.5 rounded-full bg-brand-500"
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
          width: 16px;
          height: 16px;
          border-radius: 9999px;
          background: #fff;
          border: 2px solid rgb(99 102 241);
          cursor: pointer;
        }
        .ui-kit-range-thumb::-moz-range-thumb {
          pointer-events: auto;
          width: 16px;
          height: 16px;
          border-radius: 9999px;
          background: #fff;
          border: 2px solid rgb(99 102 241);
          cursor: pointer;
        }
      `}</style>
    </div>
  )
}
