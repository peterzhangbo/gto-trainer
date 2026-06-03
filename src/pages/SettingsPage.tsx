import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/lib/i18n'
import { requestNotificationPermission, scheduleReminder } from '@/lib/notifications'

type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert'

export default function SettingsPage() {
  const { user } = useAuth()
  const { t } = useI18n()
  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [autoAdvance, setAutoAdvance] = useState(
    () => localStorage.getItem('gto-auto-advance') === 'true'
  )
  const [advanceDelay, setAdvanceDelay] = useState(
    () => Number(localStorage.getItem('gto-auto-advance-delay') || 3)
  )
  const [saved, setSaved] = useState(false)
  const [defaultDifficulty, setDefaultDifficulty] = useState<Difficulty>(
    () => (localStorage.getItem('gto-difficulty') as Difficulty) || 'intermediate'
  )
  const [dataCleared, setDataCleared] = useState(false)

  const [reminderEnabled, setReminderEnabled] = useState(
    () => localStorage.getItem('gto-reminder-enabled') === 'true'
  )
  const [reminderTime, setReminderTime] = useState(() => {
    const stored = localStorage.getItem('gto-reminder-time') || '9:0'
    const [h, m] = stored.split(':').map(Number)
    return { hour: h, minute: m }
  })
  const [reminderStatus, setReminderStatus] = useState<string | null>(null)

  const handleSave = () => {
    localStorage.setItem('gto-difficulty', defaultDifficulty)
    localStorage.setItem('gto-auto-advance', String(autoAdvance))
    localStorage.setItem('gto-auto-advance-delay', String(advanceDelay))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleClearData = () => {
    if (window.confirm(t('settings.clearConfirm'))) {
      localStorage.removeItem('gto-training-history')
      localStorage.removeItem('gto-mistakes')
      setDataCleared(true)
      setTimeout(() => setDataCleared(false), 3000)
    }
  }

  const handleToggleReminder = async () => {
    if (!reminderEnabled) {
      const granted = await requestNotificationPermission()
      if (!granted) {
        setReminderStatus(t('notification.permissionDenied'))
        setTimeout(() => setReminderStatus(null), 3000)
        return
      }
      scheduleReminder(reminderTime.hour, reminderTime.minute)
      setReminderEnabled(true)
      setReminderStatus(t('notification.enabled'))
    } else {
      localStorage.setItem('gto-reminder-enabled', 'false')
      setReminderEnabled(false)
      setReminderStatus(t('notification.disabled'))
    }
    setTimeout(() => setReminderStatus(null), 3000)
  }

  const handleTimeChange = (field: 'hour' | 'minute', value: number) => {
    const newTime = { ...reminderTime, [field]: value }
    setReminderTime(newTime)
    if (reminderEnabled) {
      scheduleReminder(newTime.hour, newTime.minute)
    }
  }

  const handleTestNotification = async () => {
    if (!('Notification' in window)) {
      setReminderStatus(t('notification.notSupported'))
      setTimeout(() => setReminderStatus(null), 3000)
      return
    }
    const granted = await requestNotificationPermission()
    if (!granted) {
      setReminderStatus(t('notification.permissionDenied'))
      setTimeout(() => setReminderStatus(null), 3000)
      return
    }
    new Notification('GTO Trainer', {
      body: t('notification.testSent'),
      icon: '/favicon.svg',
      tag: 'test-reminder'
    })
    setReminderStatus(t('notification.testSent'))
    setTimeout(() => setReminderStatus(null), 3000)
  }

  const difficulties: { key: Difficulty; labelKey: string }[] = [
    { key: 'beginner', labelKey: 'difficulty.beginner' },
    { key: 'intermediate', labelKey: 'difficulty.intermediate' },
    { key: 'advanced', labelKey: 'difficulty.advanced' },
    { key: 'expert', labelKey: 'difficulty.expert' },
  ]

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
              {/* Default difficulty */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">{t('settings.defaultDifficulty')}</label>
                <div className="grid grid-cols-2 gap-2">
                  {difficulties.map((d) => (
                    <button
                      key={d.key}
                      onClick={() => setDefaultDifficulty(d.key)}
                      className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        defaultDifficulty === d.key
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                      }`}
                    >
                      {t(d.labelKey as Parameters<typeof t>[0])}
                    </button>
                  ))}
                </div>
              </div>

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

          {/* Daily Reminder */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h2 className="text-xl font-semibold text-white mb-2">{t('notification.title')}</h2>
            <p className="text-sm text-gray-500 mb-4">{t('notification.enableDesc')}</p>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-white">{t('notification.enable')}</div>
                <button
                  onClick={handleToggleReminder}
                  className={`w-12 h-7 rounded-full transition-colors relative ${
                    reminderEnabled ? 'bg-red-600' : 'bg-gray-700'
                  }`}
                >
                  <div className={`w-6 h-6 bg-white rounded-full absolute top-0.5 transition-all ${
                    reminderEnabled ? 'left-6' : 'left-0.5'
                  }`} />
                </button>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">{t('notification.time')}</label>
                <div className="flex items-center gap-2">
                  <select
                    value={reminderTime.hour}
                    onChange={(e) => handleTimeChange('hour', Number(e.target.value))}
                    className="bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 focus:outline-none focus:border-red-500"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{String(i).padStart(2, '0')}</option>
                    ))}
                  </select>
                  <span className="text-gray-400">:</span>
                  <select
                    value={reminderTime.minute}
                    onChange={(e) => handleTimeChange('minute', Number(e.target.value))}
                    className="bg-gray-800 border border-gray-700 rounded-lg text-white px-3 py-2 focus:outline-none focus:border-red-500"
                  >
                    {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                      <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={handleTestNotification}
                className="min-h-[44px] px-6 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-medium transition-colors"
              >
                {t('notification.test')}
              </button>

              {reminderStatus && (
                <div className="text-sm text-gray-400">{reminderStatus}</div>
              )}
            </div>
          </div>

          {/* Clear training data */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h2 className="text-xl font-semibold text-white mb-2">{t('settings.clearData')}</h2>
            <p className="text-sm text-gray-500 mb-4">{t('settings.clearDataDesc')}</p>
            <button
              onClick={handleClearData}
              className="min-h-[44px] px-6 py-2 bg-red-900/50 hover:bg-red-900/70 border border-red-800 text-red-300 rounded-lg font-medium transition-colors"
            >
              {dataCleared ? t('settings.dataCleared') : t('settings.clearData')}
            </button>
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
