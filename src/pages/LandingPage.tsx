import { Link } from 'react-router-dom'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center">
        <div className="text-7xl mb-6">♠</div>
        <h1 className="text-5xl md:text-7xl font-bold text-white mb-4">
          GTO <span className="text-red-500">Trainer</span>
        </h1>
        <p className="text-xl text-gray-400 mb-8 max-w-2xl">
          德州扑克 Game Theory Optimal 策略训练平台。
          掌握最优决策，提升你的胜率。
        </p>
        <div className="flex gap-4">
          <Link
            to="/trainer"
            className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-lg transition-colors"
          >
            开始训练
          </Link>
          <Link
            to="/ranges"
            className="px-8 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-semibold text-lg transition-colors border border-gray-700"
          >
            查看范围
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-20 grid grid-cols-1 md:grid-cols-3 gap-8">
        <FeatureCard
          icon="🎯"
          title="GTO 手牌训练"
          description="根据最优策略频率进行手牌决策训练，实时反馈你的准确率。"
        />
        <FeatureCard
          icon="📊"
          title="范围矩阵查看器"
          description="13×13 手牌矩阵可视化，查看各位置的开牌、3bet、防守范围。"
        />
        <FeatureCard
          icon="🧮"
          title="EV 计算器"
          description="Monte Carlo 股权模拟，计算期望值和底池赔率。"
        />
      </section>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 hover:border-gray-700 transition-colors">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </div>
  )
}
