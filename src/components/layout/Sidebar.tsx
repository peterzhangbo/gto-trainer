import { cn } from '@/lib/utils/cn'
import { SCENARIO_TYPES, POSITIONS, STACK_DEPTHS } from '@/config/constants'
import type { SessionConfig } from '@/types'

interface SidebarProps {
  config: SessionConfig
  onConfigChange: (config: Partial<SessionConfig>) => void
  className?: string
}

export default function Sidebar({ config, onConfigChange, className }: SidebarProps) {
  const preflopScenarios = SCENARIO_TYPES.filter((s) => s.category === 'Preflop')
  const postflopScenarios = SCENARIO_TYPES.filter((s) => s.category === 'Postflop')

  return (
    <aside
      className={cn(
        'flex w-64 flex-col gap-6 border-r border-gray-800 bg-gray-900 p-4',
        className
      )}
    >
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Scenario
        </h3>
        <div className="space-y-1">
          <p className="px-2 text-[11px] font-medium uppercase text-gray-600">Preflop</p>
          {preflopScenarios.map((scenario) => (
            <button
              key={scenario.id}
              onClick={() =>
                onConfigChange({
                  scenarioType: scenario.id,
                  street: 'preflop',
                })
              }
              className={cn(
                'w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors',
                config.scenarioType === scenario.id
                  ? 'bg-red-600/20 text-red-400'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              )}
            >
              {scenario.label}
            </button>
          ))}
          <p className="mt-2 px-2 text-[11px] font-medium uppercase text-gray-600">Postflop</p>
          {postflopScenarios.map((scenario) => (
            <button
              key={scenario.id}
              onClick={() =>
                onConfigChange({
                  scenarioType: scenario.id,
                  street: 'flop',
                })
              }
              className={cn(
                'w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors',
                config.scenarioType === scenario.id
                  ? 'bg-red-600/20 text-red-400'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              )}
            >
              {scenario.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Position
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {POSITIONS.map((pos) => (
            <button
              key={pos}
              onClick={() => onConfigChange({ position: pos })}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-bold transition-colors',
                config.position === pos
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              )}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Stack Depth (BB)
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {STACK_DEPTHS.map((depth) => (
            <button
              key={depth}
              onClick={() => onConfigChange({ stackDepth: depth })}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-bold transition-colors',
                config.stackDepth === depth
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              )}
            >
              {depth}
            </button>
          ))}
        </div>
      </div>

      {config.street !== 'preflop' && (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Street
          </h3>
          <div className="flex gap-1.5">
            {(['flop', 'turn', 'river'] as const).map((street) => (
              <button
                key={street}
                onClick={() => onConfigChange({ street })}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition-colors',
                  config.street === street
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                )}
              >
                {street}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Settings
        </h3>
        <label className="flex cursor-pointer items-center gap-3">
          <div className="relative">
            <input
              type="checkbox"
              checked={config.autoAdvance}
              onChange={(e) => onConfigChange({ autoAdvance: e.target.checked })}
              className="peer sr-only"
            />
            <div className="h-5 w-9 rounded-full bg-gray-700 peer-checked:bg-red-600 transition-colors" />
            <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
          </div>
          <span className="text-sm text-gray-300">Auto-advance</span>
        </label>
      </div>
    </aside>
  )
}
