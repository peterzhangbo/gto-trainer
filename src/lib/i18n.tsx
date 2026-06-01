import { createContext, useContext, useState, type ReactNode } from 'react'

type Lang = 'zh' | 'en'

const translations = {
  zh: {
    // Navbar
    'nav.training': '训练',
    'nav.ranges': '范围',
    'nav.calculator': 'EV计算',
    'nav.dashboard': '仪表板',
    'nav.login': '登录',
    'nav.logout': '退出',
    'nav.settings': '设置',

    // Landing page
    'landing.title': 'GTO 德州扑克训练平台',
    'landing.subtitle': '基于博弈论最优策略的扑克训练工具',
    'landing.start': '开始训练',
    'landing.viewRanges': '查看范围',
    'landing.features': '功能特点',
    'landing.feature1.title': 'GTO 手牌训练',
    'landing.feature1.desc': '根据最优策略频率进行手牌决策训练，实时反馈你的准确率。',
    'landing.feature2.title': '范围矩阵查看器',
    'landing.feature2.desc': '13×13 手牌矩阵可视化，查看各位置的开牌、3bet、防守范围。',
    'landing.feature3.title': 'EV 计算器',
    'landing.feature3.desc': 'Monte Carlo 股权模拟，计算期望值和底池赔率。',

    // Trainer
    'trainer.select': '选择训练场景',
    'trainer.start': '开始训练',
    'trainer.fold': '弃牌',
    'trainer.call': '跟注',
    'trainer.raise': '加注',
    'trainer.check': '过牌',
    'trainer.threebet': '三次加注',
    'trainer.next': '下一题 →',
    'trainer.correct': '✓ 正确！',
    'trainer.wrong': '✗ 不是最优选择',
    'trainer.score': '得分',
    'trainer.stats': '训练统计',
    'trainer.hands': '总手数',
    'trainer.accuracy': '正确率',
    'trainer.streak': '连对',
    'trainer.bestStreak': '最高连对',
    'trainer.end': '结束训练',
    'trainer.gto': 'GTO 频率分布',
    'trainer.hand': '手牌',
    'trainer.selectAction': '选择你的操作',
    'trainer.yourChoice': '你的选择',
    'trainer.showStats': '显示统计 ▼',
    'trainer.hideStats': '隐藏统计 ▲',

    // Range viewer
    'range.title': '范围查看器',
    'range.preflop': '翻前',
    'range.postflop': '翻后',
    'range.range': '范围',
    'range.hands': '手牌',
    'range.legend': '图例',
    'range.clickDetail': '点击矩阵中的手牌查看详细策略',
    'range.combos': '组合',
    'range.suited': '同花',
    'range.offsuit': '非同花',
    'range.pair': '对子',
    'range.notInRange': '不在范围内',
    'range.foldFull': '弃牌 100%',
    'range.mixedStrategy': '混合策略',
    'range.mainly': '主要',
    'range.exampleBoard': '示例牌面:',
    'range.handCategories': '手牌类别',

    // EV Calculator
    'calc.title': 'EV 计算器',
    'calc.hero': '己方手牌',
    'calc.villain': '对手手牌',
    'calc.board': '公共牌',
    'calc.equity': '胜率',
    'calc.potSize': '底池大小',
    'calc.betToCall': '需要跟注',
    'calc.ev': '期望值',
    'calc.calculate': '计算 EV',
    'calc.calculating': '计算中...',
    'calc.reset': '重置',
    'calc.win': '胜',
    'calc.tie': '平',
    'calc.lose': '负',
    'calc.potSettings': '底池设置',
    'calc.potOdds': '底池赔率',
    'calc.results': '计算结果',
    'calc.unselected': '未选择',

    // Dashboard
    'dash.title': '训练仪表板',
    'dash.total': '总训练手数',
    'dash.overall': '整体正确率',
    'dash.preflop': '翻前正确率',
    'dash.postflop': '翻后正确率',
    'dash.streak': '连续记录',
    'dash.current': '当前连对',
    'dash.longest': '最高连对',
    'dash.performance': '场景表现',
    'dash.recent': '最近训练',
    'dash.date': '日期',
    'dash.scenario': '场景',
    'dash.hands': '手数',
    'dash.accuracy': '正确率',
    'dash.noData': '暂无数据',
    'dash.loginFirst': '请先登录查看训练数据',
    'dash.loading': '加载中...',
    'dash.goTrain': '还没有训练记录，去训练页面开始吧',
    'dash.handsSuffix': '手',

    // Auth
    'auth.login': '登录',
    'auth.signup': '注册',
    'auth.email': '邮箱',
    'auth.password': '密码',
    'auth.nickname': '昵称',
    'auth.noAccount': '还没有账号？',
    'auth.hasAccount': '已有账号？',
    'auth.goSignup': '注册',
    'auth.goLogin': '登录',
    'auth.loginDesc': '登录以保存训练记录',
    'auth.signupDesc': '创建账号，开始你的 GTO 训练之旅',
    'auth.loggingIn': '登录中...',
    'auth.signingUp': '注册中...',
    'auth.loginFailed': '登录失败，请检查邮箱和密码',
    'auth.signupFailed': '注册失败，请稍后重试',
    'auth.passwordMin': '密码至少需要6个字符',
    'auth.backHome': '← 返回首页',
    'auth.placeholder': 'your@email.com',
    'auth.passwordPlaceholder': '••••••••',
    'auth.nicknamePlaceholder': '你的昵称',

    // Scenario names
    'scenario.rfi': '翻前加注',
    'scenario.threebet': '三次加注',
    'scenario.defend': 'BB 防守',
    'scenario.cbet': '持续下注',
    'scenario.turn': '转牌',
    'scenario.river': '河牌',

    // Settings
    'settings.title': '设置',
    'settings.profile': '个人资料',
    'settings.displayName': '昵称',
    'settings.email': '邮箱',
    'settings.notLogged': '未登录',
    'settings.trainingPref': '训练偏好',
    'settings.autoAdvance': '自动下一题',
    'settings.autoAdvanceDesc': '显示结果后自动进入下一题',
    'settings.delay': '延迟（秒）',
    'settings.seconds': '秒',
    'settings.save': '保存设置',
    'settings.saved': '已保存 ✓',

    // Action labels (used in RangeViewer)
    'action.raise': '加注',
    'action.threeBet': '三次加注',
    'action.fourBet': '四次加注',
    'action.call': '跟注',
    'action.check': '过牌',
    'action.fold': '弃牌',
    'action.bet75': '下注75%',
    'action.bet50': '下注50%',
    'action.bet33': '下注33%',
    'action.bet100': '下注100%',

    // Navbar
    'navbar.signIn': '登录',
    'navbar.signOut': '退出',

    // Equity display
    'equity.hero': '己方',
    'equity.villain': '对手',
    'equity.tie': '平局',

    // Misc
    'trainer.noStrategyData': '暂无策略数据',
  },
  en: {
    'nav.training': 'Training',
    'nav.ranges': 'Ranges',
    'nav.calculator': 'EV Calc',
    'nav.dashboard': 'Dashboard',
    'nav.login': 'Login',
    'nav.logout': 'Logout',
    'nav.settings': 'Settings',
    'landing.title': 'GTO Poker Training Platform',
    'landing.subtitle': 'Game Theory Optimal poker training tool',
    'landing.start': 'Start Training',
    'landing.viewRanges': 'View Ranges',
    'landing.features': 'Features',
    'landing.feature1.title': 'GTO Hand Trainer',
    'landing.feature1.desc': 'Master optimal strategy through practice with real-time accuracy feedback.',
    'landing.feature2.title': 'Range Matrix Viewer',
    'landing.feature2.desc': '13x13 hand matrix visualization for opening, 3bet, and defending ranges by position.',
    'landing.feature3.title': 'EV Calculator',
    'landing.feature3.desc': 'Monte Carlo equity simulation for expected value and pot odds calculations.',
    'trainer.select': 'Select Training Scenario',
    'trainer.start': 'Start Training',
    'trainer.fold': 'Fold',
    'trainer.call': 'Call',
    'trainer.raise': 'Raise',
    'trainer.check': 'Check',
    'trainer.threebet': '3-Bet',
    'trainer.next': 'Next →',
    'trainer.correct': '✓ Correct!',
    'trainer.wrong': '✗ Not Optimal',
    'trainer.score': 'Score',
    'trainer.stats': 'Session Stats',
    'trainer.hands': 'Total Hands',
    'trainer.accuracy': 'Accuracy',
    'trainer.streak': 'Streak',
    'trainer.bestStreak': 'Best Streak',
    'trainer.end': 'End Session',
    'trainer.gto': 'GTO Frequency Distribution',
    'trainer.hand': 'Hand',
    'trainer.selectAction': 'Choose your action',
    'trainer.yourChoice': 'Your choice',
    'trainer.showStats': 'Show Stats ▼',
    'trainer.hideStats': 'Hide Stats ▲',
    'range.title': 'Range Viewer',
    'range.preflop': 'Preflop',
    'range.postflop': 'Postflop',
    'range.range': 'Range',
    'range.hands': 'hands',
    'range.legend': 'Legend',
    'range.clickDetail': 'Click a hand in the matrix to view strategy details',
    'range.combos': 'combos',
    'range.suited': 'suited',
    'range.offsuit': 'offsuit',
    'range.pair': 'pair',
    'range.notInRange': 'Not in range',
    'range.foldFull': 'Fold 100%',
    'range.mixedStrategy': 'Mixed',
    'range.mainly': 'mainly',
    'range.exampleBoard': 'Example board:',
    'range.handCategories': 'hand categories',
    'calc.title': 'EV Calculator',
    'calc.hero': 'Hero Hand',
    'calc.villain': 'Villain Hand',
    'calc.board': 'Board',
    'calc.equity': 'Equity',
    'calc.potSize': 'Pot Size',
    'calc.betToCall': 'Bet to Call',
    'calc.ev': 'Expected Value',
    'calc.calculate': 'Calculate EV',
    'calc.calculating': 'Calculating...',
    'calc.reset': 'Reset',
    'calc.win': 'Win',
    'calc.tie': 'Tie',
    'calc.lose': 'Lose',
    'calc.potSettings': 'Pot Settings',
    'calc.potOdds': 'Pot Odds',
    'calc.results': 'Results',
    'calc.unselected': 'Unselected',
    'dash.title': 'Training Dashboard',
    'dash.total': 'Total Hands',
    'dash.overall': 'Overall Accuracy',
    'dash.preflop': 'Preflop Accuracy',
    'dash.postflop': 'Postflop Accuracy',
    'dash.streak': 'Streak Records',
    'dash.current': 'Current Streak',
    'dash.longest': 'Best Streak',
    'dash.performance': 'Scenario Performance',
    'dash.recent': 'Recent Sessions',
    'dash.date': 'Date',
    'dash.scenario': 'Scenario',
    'dash.hands': 'Hands',
    'dash.accuracy': 'Accuracy',
    'dash.noData': 'No data yet',
    'dash.loginFirst': 'Please log in to view training data',
    'dash.loading': 'Loading...',
    'dash.goTrain': 'No sessions yet. Head to Training to get started!',
    'dash.handsSuffix': 'h',
    'auth.login': 'Login',
    'auth.signup': 'Sign Up',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.nickname': 'Nickname',
    'auth.noAccount': "Don't have an account?",
    'auth.hasAccount': 'Already have an account?',
    'auth.goSignup': 'Sign Up',
    'auth.goLogin': 'Log In',
    'auth.loginDesc': 'Log in to save your training records',
    'auth.signupDesc': 'Create an account and start your GTO training journey',
    'auth.loggingIn': 'Logging in...',
    'auth.signingUp': 'Signing up...',
    'auth.loginFailed': 'Login failed. Please check your email and password.',
    'auth.signupFailed': 'Sign up failed. Please try again.',
    'auth.passwordMin': 'Password must be at least 6 characters',
    'auth.backHome': '← Back to Home',
    'auth.placeholder': 'your@email.com',
    'auth.passwordPlaceholder': '••••••••',
    'auth.nicknamePlaceholder': 'Your nickname',
    'scenario.rfi': 'RFI',
    'scenario.threebet': '3-Bet',
    'scenario.defend': 'BB Defend',
    'scenario.cbet': 'C-Bet',
    'scenario.turn': 'Turn',
    'scenario.river': 'River',
    'settings.title': 'Settings',
    'settings.profile': 'Profile',
    'settings.displayName': 'Display Name',
    'settings.email': 'Email',
    'settings.notLogged': 'Not logged in',
    'settings.trainingPref': 'Training Preferences',
    'settings.autoAdvance': 'Auto Next',
    'settings.autoAdvanceDesc': 'Automatically advance to next hand after result',
    'settings.delay': 'Delay (seconds)',
    'settings.seconds': 's',
    'settings.save': 'Save Settings',
    'settings.saved': 'Saved ✓',
    'action.raise': 'Raise',
    'action.threeBet': '3-Bet',
    'action.fourBet': '4-Bet',
    'action.call': 'Call',
    'action.check': 'Check',
    'action.fold': 'Fold',
    'action.bet75': 'Bet 75%',
    'action.bet50': 'Bet 50%',
    'action.bet33': 'Bet 33%',
    'action.bet100': 'Bet 100%',

    // Navbar
    'navbar.signIn': 'Sign In',
    'navbar.signOut': 'Sign Out',

    // Equity display
    'equity.hero': 'Hero',
    'equity.villain': 'Villain',
    'equity.tie': 'Tie',

    // Misc
    'trainer.noStrategyData': 'No strategy data',
  },
} as const

type Translations = typeof translations
type Key = keyof Translations['zh']

interface I18nContextType {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: Key) => string
}

const I18nContext = createContext<I18nContextType | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('gto-lang') as Lang) || 'zh'
    }
    return 'zh'
  })

  const t = (key: Key): string => {
    return translations[lang][key] ?? key
  }

  const handleSetLang = (newLang: Lang) => {
    setLang(newLang)
    localStorage.setItem('gto-lang', newLang)
  }

  return (
    <I18nContext.Provider value={{ lang, setLang: handleSetLang, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
