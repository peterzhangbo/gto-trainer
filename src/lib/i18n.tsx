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

    // Trainer - postflop
    'trainer.preflopGroup': '翻前',
    'trainer.postflopGroup': '翻后',
    'trainer.board': '公共牌',
    'trainer.category': '手牌类型',
    'trainer.bestAction': '最佳操作',
    'trainer.bestActionShort': '最佳',
    'trainer.comment': '训练师评语',

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
    'range.compareMode': '对比模式',
    'range.compareModeOff': '退出对比',
    'range.selectOverlay': '选择对比场景',
    'range.range1': '范围1',
    'range.range2': '范围2',
    'range.legendCombos': '组合',
    'range.rangeCoverage': '覆盖率',
    'range.vs': 'vs',

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

    // Action helpers
    'action.bestAction': '最佳:',
    'action.allIn': '全下',

    // Toast messages
    'toast.sessionSaveFailed': '保存训练会话失败',
    'toast.sessionUpdateFailed': '更新训练会话失败',

    // GTO label prefix (used in drill details)
    'drill.gtoLabel': 'GTO',

    // Mistake Book
    'nav.mistakes': '错题本',
    'mistake.title': '错题本',
    'mistake.total': '总错题',
    'mistake.repractice': '重新练习',
    'mistake.noMistakes': '暂无错题，继续保持！',
    'mistake.yourAction': '你的选择',
    'mistake.correctAction': '正确选择',
    'mistake.frequencies': 'GTO 频率',
    'mistake.filterAll': '全部',
    'mistake.accuracy': '正确率',
    'mistake.date': '日期',
    'mistake.loginFirst': '请先登录查看错题本',

    // History
    'nav.history': '历史',
    'history.title': '训练历史',
    'history.session': '训练记录',
    'history.expand': '查看详情',
    'history.collapse': '收起详情',
    'history.noSessions': '暂无训练记录',
    'history.loginFirst': '请先登录查看训练历史',
    'history.handsPlayed': '手牌数',
    'history.score': '得分',
    'history.correct': '正确',
    'history.wrong': '错误',
    'history.loading': '加载中...',

    // Difficulty
    'difficulty.title': '难度选择',
    'difficulty.beginner': '初级',
    'difficulty.beginnerDesc': '仅展示强牌和明确弃牌',
    'difficulty.intermediate': '中级',
    'difficulty.intermediateDesc': '包含混合策略的标准训练',
    'difficulty.advanced': '高级',
    'difficulty.advancedDesc': '展示接近频率的手牌决策',
    'difficulty.expert': '专家',
    'difficulty.expertDesc': '训练结束后才显示结果',

    // Settings
    'settings.defaultDifficulty': '默认难度',
    'settings.clearData': '清除训练数据',
    'settings.clearDataDesc': '删除本地保存的所有训练记录',
    'settings.clearConfirm': '确认清除所有本地训练数据？',
    'settings.dataCleared': '训练数据已清除',

    // Landing page (polish additions)
    'landing.stats.hands': '500+ 训练手牌',
    'landing.stats.scenarios': '8 种训练场景',
    'landing.stats.feedback': '实时反馈',
    'landing.quickStart': '快速开始',
    'landing.quickStart.step1.title': '选择场景',
    'landing.quickStart.step1.desc': '从翻前加注、3bet、BB防守等场景中选择训练目标。',
    'landing.quickStart.step2.title': '做出决策',
    'landing.quickStart.step2.desc': '根据你的判断选择最优操作：弃牌、跟注或加注。',
    'landing.quickStart.step3.title': '查看反馈',
    'landing.quickStart.step3.desc': '对比 GTO 最优策略，查看准确率和频率分布。',
    'landing.quote.text': '"GTO 不是记忆策略，而是理解为什么这个频率是最优的。"',
    'landing.quote.author': '— 博弈论最优策略的核心理念',
    'landing.cta.title': '准备好提升你的扑克水平了吗？',
    'landing.cta.subtitle': '从今天开始，用数据驱动的方式磨练你的 GTO 直觉。',

    // Error boundary
    'error.title': '出现了问题',
    'error.message': '发生了意外错误。',
    'error.tryAgain': '重试',
    'error.reload': '刷新页面',

    // Loading
    'loading.default': '加载中...',
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

    // Trainer - postflop
    'trainer.preflopGroup': 'Preflop',
    'trainer.postflopGroup': 'Postflop',
    'trainer.board': 'Board',
    'trainer.category': 'Hand Category',
    'trainer.bestAction': 'Best Action',
    'trainer.bestActionShort': 'Best',
    'trainer.comment': 'Trainer Comment',

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
    'range.compareMode': 'Compare',
    'range.compareModeOff': 'Exit Compare',
    'range.selectOverlay': 'Select overlay scenario',
    'range.range1': 'Range 1',
    'range.range2': 'Range 2',
    'range.legendCombos': 'combos',
    'range.rangeCoverage': 'coverage',
    'range.vs': 'vs',
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

    // Action helpers
    'action.bestAction': 'Best:',
    'action.allIn': 'All In',

    // Toast messages
    'toast.sessionSaveFailed': 'Failed to save session',
    'toast.sessionUpdateFailed': 'Failed to update session',

    // GTO label prefix (used in drill details)
    'drill.gtoLabel': 'GTO',

    // Mistake Book
    'nav.mistakes': 'Mistakes',
    'mistake.title': 'Mistake Book',
    'mistake.total': 'Total Mistakes',
    'mistake.repractice': 'Re-practice',
    'mistake.noMistakes': 'No mistakes yet. Keep it up!',
    'mistake.yourAction': 'Your Action',
    'mistake.correctAction': 'Correct Action',
    'mistake.frequencies': 'GTO Frequencies',
    'mistake.filterAll': 'All',
    'mistake.accuracy': 'Accuracy',
    'mistake.date': 'Date',
    'mistake.loginFirst': 'Please log in to view your mistake book',

    // History
    'nav.history': 'History',
    'history.title': 'Training History',
    'history.session': 'Session',
    'history.expand': 'View Details',
    'history.collapse': 'Hide Details',
    'history.noSessions': 'No training sessions yet',
    'history.loginFirst': 'Please log in to view training history',
    'history.handsPlayed': 'Hands Played',
    'history.score': 'Score',
    'history.correct': 'Correct',
    'history.wrong': 'Wrong',
    'history.loading': 'Loading...',

    // Difficulty
    'difficulty.title': 'Difficulty',
    'difficulty.beginner': 'Beginner',
    'difficulty.beginnerDesc': 'Only strong hands and clear folds',
    'difficulty.intermediate': 'Intermediate',
    'difficulty.intermediateDesc': 'Standard training with mixed strategies',
    'difficulty.advanced': 'Advanced',
    'difficulty.advancedDesc': 'Close frequency hands requiring precise decisions',
    'difficulty.expert': 'Expert',
    'difficulty.expertDesc': 'No feedback until session ends',

    // Settings
    'settings.defaultDifficulty': 'Default Difficulty',
    'settings.clearData': 'Clear Training Data',
    'settings.clearDataDesc': 'Delete all locally saved training records',
    'settings.clearConfirm': 'Are you sure you want to clear all local training data?',
    'settings.dataCleared': 'Training data cleared',

    // Landing page (polish additions)
    'landing.stats.hands': '500+ Training Hands',
    'landing.stats.scenarios': '8 Scenarios',
    'landing.stats.feedback': 'Real-time Feedback',
    'landing.quickStart': 'Quick Start',
    'landing.quickStart.step1.title': 'Choose a Scenario',
    'landing.quickStart.step1.desc': 'Pick from RFI, 3-bet, BB defend and more training scenarios.',
    'landing.quickStart.step2.title': 'Make Your Decision',
    'landing.quickStart.step2.desc': 'Choose the optimal action: fold, call, or raise based on your read.',
    'landing.quickStart.step3.title': 'Review Feedback',
    'landing.quickStart.step3.desc': 'Compare against GTO optimal strategy with accuracy and frequency breakdown.',
    'landing.quote.text': '"GTO is not memorizing strategies -- it is understanding why a frequency is optimal."',
    'landing.quote.author': '— The core philosophy of Game Theory Optimal play',
    'landing.cta.title': 'Ready to level up your poker game?',
    'landing.cta.subtitle': 'Start sharpening your GTO intuition today with data-driven practice.',

    // Error boundary
    'error.title': 'Something went wrong',
    'error.message': 'An unexpected error occurred.',
    'error.tryAgain': 'Try Again',
    'error.reload': 'Reload Page',

    // Loading
    'loading.default': 'Loading...',
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

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
