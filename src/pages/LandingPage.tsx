import { useState, useEffect, useRef } from 'react'
/* eslint-disable react-hooks/refs */
import { Link } from 'react-router-dom'
import { useI18n } from '@/lib/i18n'

/* ------------------------------------------------------------------ */
/* Animated Counter Hook                                               */
/* ------------------------------------------------------------------ */

function useCountUp(end: number, duration = 2000, startOnView = true) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const hasAnimated = useRef(false)

  useEffect(() => {
    if (!startOnView || !ref.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true
          const start = performance.now()
          const step = (now: number) => {
            const elapsed = now - start
            const progress = Math.min(elapsed / duration, 1)
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3)
            setCount(Math.round(eased * end))
            if (progress < 1) requestAnimationFrame(step)
          }
          requestAnimationFrame(step)
        }
      },
      { threshold: 0.3 }
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [end, duration, startOnView])

  return { count, ref }
}

/* ------------------------------------------------------------------ */
/* Intersection Observer Hook for scroll animations                    */
/* ------------------------------------------------------------------ */

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    if (!ref.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { threshold }
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [threshold])

  return { ref, inView }
}

/* ------------------------------------------------------------------ */
/* Stat Counter Component                                              */
/* ------------------------------------------------------------------ */

function StatCounter({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const { count, ref } = useCountUp(value)
  return (
    <div ref={ref} className="text-center">
      <div className="text-3xl md:text-4xl font-bold text-white mb-1">
        {count}{suffix}
      </div>
      <div className="text-sm text-gray-400">{label}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Poker Table SVG                                                     */
/* ------------------------------------------------------------------ */


/* ------------------------------------------------------------------ */
/* Landing Page                                                        */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  const { t } = useI18n()

  // Scroll animation sections
  const statsSection = useInView()
  const featuresSection = useInView()
  const stepsSection = useInView()
  const quoteSection = useInView()
  const ctaSection = useInView()

  return (
    <div className="min-h-screen overflow-hidden" style={{ background: 'linear-gradient(135deg, #0f0f23 0%, #1a0a2e 25%, #16213e 50%, #0f0f23 100%)' }}>
      {/* ---------------------------------------------------------------- */}
      {/* Hero Section                                                      */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative flex items-center justify-center min-h-[85vh] px-4">
        {/* Background decorative elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Large subtle glow spots */}
          <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-red-600/8 rounded-full blur-[150px]" />
          <div className="absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-blue-600/8 rounded-full blur-[150px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-900/5 rounded-full blur-[200px]" />
          {/* Floating card suits */}
          <div className="absolute top-1/4 left-[15%] text-6xl opacity-[0.03] animate-float" style={{ animationDelay: '0s' }}>♠</div>
          <div className="absolute top-1/3 right-[10%] text-5xl opacity-[0.03] animate-float" style={{ animationDelay: '1s' }}>♥</div>
          <div className="absolute bottom-1/4 left-[20%] text-4xl opacity-[0.03] animate-float" style={{ animationDelay: '2s' }}>♦</div>
          <div className="absolute bottom-1/3 right-[25%] text-6xl opacity-[0.03] animate-float" style={{ animationDelay: '0.5s' }}>♣</div>
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        </div>

        <div className="relative z-10 flex flex-col items-center text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="animate-slide-up mb-6">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-600/10 border border-red-600/20 text-red-400 text-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              基于博弈论最优策略
            </span>
          </div>

          {/* Title */}
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-white mb-6 animate-fade-in tracking-tight">
            GTO<span className="text-red-500">.</span>
          </h1>
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white/90 mb-4 animate-fade-in stagger-1">
            德州扑克训练平台
          </h2>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-gray-400 mb-12 max-w-xl animate-slide-up stagger-2 leading-relaxed">
            {t('landing.subtitle')}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 animate-slide-up stagger-3">
            <Link
              to="/trainer"
              className="group min-h-[52px] px-10 py-3.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-semibold text-lg transition-all hover:shadow-xl hover:shadow-red-600/30 hover:-translate-y-0.5 flex items-center justify-center"
            >
              {t('landing.start')}
              <span className="ml-2 transition-transform group-hover:translate-x-1">→</span>
            </Link>
            <Link
              to="/ranges"
              className="group min-h-[52px] px-10 py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-semibold text-lg transition-all border border-white/10 hover:border-white/20 hover:-translate-y-0.5 flex items-center justify-center backdrop-blur-sm"
            >
              {t('landing.viewRanges')}
            </Link>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Stats Bar                                                         */}
      {/* ---------------------------------------------------------------- */}
      <section
        ref={statsSection.ref}
        className={`border-y border-gray-800/50 bg-gray-900/30 transition-all duration-700 ${
          statsSection.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <div className="max-w-4xl mx-auto px-4 py-10 md:py-12 grid grid-cols-3 gap-4">
          <StatCounter value={500} suffix="+" label={t('landing.stats.hands')} />
          <StatCounter value={8} suffix="" label={t('landing.stats.scenarios')} />
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold text-red-400 mb-1">⚡</div>
            <div className="text-sm text-gray-400">{t('landing.stats.feedback')}</div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Features                                                          */}
      {/* ---------------------------------------------------------------- */}
      <section
        ref={featuresSection.ref}
        className={`max-w-6xl mx-auto px-4 py-16 md:py-24 transition-all duration-700 delay-100 ${
          featuresSection.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-12">
          {t('landing.features')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FeatureCard
            icon="🎯"
            title={t('landing.feature1.title')}
            description={t('landing.feature1.desc')}
            delay={0}
            inView={featuresSection.inView}
          />
          <FeatureCard
            icon="📊"
            title={t('landing.feature2.title')}
            description={t('landing.feature2.desc')}
            delay={150}
            inView={featuresSection.inView}
          />
          <FeatureCard
            icon="🧮"
            title={t('landing.feature3.title')}
            description={t('landing.feature3.desc')}
            delay={300}
            inView={featuresSection.inView}
          />
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Quick Start Steps                                                 */}
      {/* ---------------------------------------------------------------- */}
      <section
        ref={stepsSection.ref}
        className={`max-w-5xl mx-auto px-4 py-16 md:py-24 transition-all duration-700 ${
          stepsSection.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-14">
          {t('landing.quickStart')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          <StepCard
            number={1}
            title={t('landing.quickStart.step1.title')}
            description={t('landing.quickStart.step1.desc')}
            inView={stepsSection.inView}
            delay={0}
          />
          <StepCard
            number={2}
            title={t('landing.quickStart.step2.title')}
            description={t('landing.quickStart.step2.desc')}
            inView={stepsSection.inView}
            delay={200}
          />
          <StepCard
            number={3}
            title={t('landing.quickStart.step3.title')}
            description={t('landing.quickStart.step3.desc')}
            inView={stepsSection.inView}
            delay={400}
          />
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Quote / Testimonial                                               */}
      {/* ---------------------------------------------------------------- */}
      <section
        ref={quoteSection.ref}
        className={`border-y border-gray-800/50 bg-gray-900/20 transition-all duration-700 ${
          quoteSection.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <div className="max-w-3xl mx-auto px-4 py-16 md:py-20 text-center">
          <div className="text-5xl text-red-500/30 mb-6 font-serif">"</div>
          <blockquote className="text-xl md:text-2xl text-gray-300 leading-relaxed font-light">
            {t('landing.quote.text')}
          </blockquote>
          <cite className="block mt-6 text-sm text-gray-500 not-italic">
            {t('landing.quote.author')}
          </cite>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Final CTA                                                         */}
      {/* ---------------------------------------------------------------- */}
      <section
        ref={ctaSection.ref}
        className={`py-20 md:py-28 transition-all duration-700 ${
          ctaSection.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            {t('landing.cta.title')}
          </h2>
          <p className="text-gray-400 mb-8 text-lg">
            {t('landing.cta.subtitle')}
          </p>
          <Link
            to="/trainer"
            className="group inline-flex items-center min-h-[52px] px-12 py-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-lg transition-all hover:shadow-lg hover:shadow-red-600/25 hover:-translate-y-0.5"
          >
            {t('landing.start')}
            <span className="ml-2 transition-transform group-hover:translate-x-1">→</span>
          </Link>
        </div>
      </section>

      {/* Footer spacer */}
      <div className="h-8" />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function FeatureCard({ icon, title, description, delay, inView }: { icon: string; title: string; description: string; delay: number; inView: boolean }) {
  return (
    <div
      className={`bg-gray-900/80 rounded-xl border border-gray-800 p-6 hover:border-gray-700 hover:bg-gray-900 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 ${
        inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400 leading-relaxed">{description}</p>
    </div>
  )
}

function StepCard({ number, title, description, inView, delay }: { number: number; title: string; description: string; inView: boolean; delay: number }) {
  return (
    <div
      className={`relative text-center transition-all duration-600 ${
        inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {/* Number circle */}
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-600/10 border border-red-600/30 text-red-400 text-2xl font-bold mb-5">
        {number}
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
      {/* Connecting line (hidden on last card and mobile) */}
      {number < 3 && (
        <div className="hidden md:block absolute top-7 left-[calc(50%+40px)] w-[calc(100%-80px)] h-px bg-gradient-to-r from-red-600/30 to-transparent" />
      )}
    </div>
  )
}
