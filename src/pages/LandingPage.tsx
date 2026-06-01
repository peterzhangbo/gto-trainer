import { Link } from 'react-router-dom'
import { useI18n } from '@/lib/i18n'

export default function LandingPage() {
  const { t } = useI18n()

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center">
        <div className="text-7xl mb-6">♠</div>
        <h1 className="text-5xl md:text-7xl font-bold text-white mb-4">
          GTO <span className="text-red-500">Trainer</span>
        </h1>
        <p className="text-xl text-gray-400 mb-8 max-w-2xl">
          {t('landing.subtitle')}
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            to="/trainer"
            className="min-h-[44px] px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-base md:text-lg transition-colors flex items-center justify-center"
          >
            {t('landing.start')}
          </Link>
          <Link
            to="/ranges"
            className="min-h-[44px] px-8 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-semibold text-base md:text-lg transition-colors border border-gray-700 flex items-center justify-center"
          >
            {t('landing.viewRanges')}
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-12 md:py-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
        <FeatureCard
          icon="🎯"
          title={t('landing.feature1.title')}
          description={t('landing.feature1.desc')}
        />
        <FeatureCard
          icon="📊"
          title={t('landing.feature2.title')}
          description={t('landing.feature2.desc')}
        />
        <FeatureCard
          icon="🧮"
          title={t('landing.feature3.title')}
          description={t('landing.feature3.desc')}
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
