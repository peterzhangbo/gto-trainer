import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/lib/i18n'

export default function SettingsPage() {
  const { user } = useAuth()
  const { t } = useI18n()
  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [autoAdvance, setAutoAdvance] = useState(false)
  const [advanceDelay, setAdvanceDelay] = useState(3)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    // TODO: persist to Supabase
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gray-950 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-6 md:mb-8">{t('settings.title')}</h1>

        <div className="space-y-6">
          {/* Profile */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h2 className="text-xl font-semibold text-white mb-4">{t('settings.profile')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('settings.email')}</label>
                <div className="px-4 py-2 bg-gray-800 rounded-lg text-gray-500">{user?.email ?? t('settings.notLogged')}</div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">{t('settings.displayName')}</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full min-h-[44px] px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
                />
              </div>
            </div>
          </div>

          {/* Training preferences */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h2 className="text-xl font-semibold text-white mb-4">{t('settings.trainingPref')}</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white">{t('settings.autoAdvance')}</div>
                  <div className="text-sm text-gray-500">{t('settings.autoAdvanceDesc')}</div>
                </div>
                <button
                  onClick={() => setAutoAdvance(!autoAdvance)}
                  className={`w-12 h-7 rounded-full transition-colors relative ${
                    autoAdvance ? 'bg-red-600' : 'bg-gray-700'
                  }`}
                >
                  <div className={`w-6 h-6 bg-white rounded-full absolute top-0.5 transition-all ${
                    autoAdvance ? 'left-6' : 'left-0.5'
                  }`} />
                </button>
              </div>

              {autoAdvance && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">{t('settings.delay')}</label>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={advanceDelay}
                    onChange={(e) => setAdvanceDelay(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="text-sm text-gray-500">{advanceDelay} {t('settings.seconds')}</div>
                </div>
              )}
            </div>
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            className="min-h-[44px] px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-semibold transition-colors"
          >
            {saved ? t('settings.saved') : t('settings.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
