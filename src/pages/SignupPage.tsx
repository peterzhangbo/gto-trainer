import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export default function SignupPage() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('密码至少需要6个字符')
      return
    }
    setLoading(true)
    try {
      await signUp(email, password, displayName)
      navigate('/trainer')
    } catch (err) {
      setError('注册失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-950">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">♠</div>
          <h1 className="text-3xl font-bold text-white">注册</h1>
          <p className="text-gray-400 mt-2">创建账号，开始你的 GTO 训练之旅</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-4">
          {error && (
            <div className="bg-red-900/50 border border-red-800 text-red-200 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">昵称</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
              placeholder="你的昵称"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-red-500"
              placeholder="至少6个字符"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white rounded-lg font-semibold transition-colors"
          >
            {loading ? '注册中...' : '注册'}
          </button>

          <p className="text-center text-gray-400 text-sm">
            已有账号？{' '}
            <Link to="/login" className="text-red-400 hover:text-red-300">登录</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
