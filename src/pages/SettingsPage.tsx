import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

export default function SettingsPage() {
  const { user } = useAuth()
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
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">设置</h1>

        <div className="space-y-6">
          {/* Profile */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h2 className="text-xl font-semibold text-white mb-4">个人资料</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">邮箱</label>
                <div className="px-4 py-2 bg-gray-800 rounded-lg text-gray-500">{user?.email ?? '未登录'}</div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">昵称</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
                />
              </div>
            </div>
          </div>

          {/* Training preferences */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h2 className="text-xl font-semibold text-white mb-4">训练偏好</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white">自动下一题</div>
                  <div className="text-sm text-gray-500">显示结果后自动进入下一题</div>
                </div>
                <button
                  onClick={() => setAutoAdvance(!autoAdvance)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    autoAdvance ? 'bg-red-600' : 'bg-gray-700'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${
                    autoAdvance ? 'left-6' : 'left-0.5'
                  }`} />
                </button>
              </div>

              {autoAdvance && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">延迟（秒）</label>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={advanceDelay}
                    onChange={(e) => setAdvanceDelay(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="text-sm text-gray-500">{advanceDelay} 秒</div>
                </div>
              )}
            </div>
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-semibold transition-colors"
          >
            {saved ? '已保存 ✓' : '保存设置'}
          </button>
        </div>
      </div>
    </div>
  )
}
