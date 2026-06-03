export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export function scheduleReminder(hour: number, minute: number) {
  localStorage.setItem('gto-reminder-time', `${hour}:${minute}`)
  localStorage.setItem('gto-reminder-enabled', 'true')
}

export function checkReminder() {
  const enabled = localStorage.getItem('gto-reminder-enabled')
  if (enabled !== 'true') return

  const time = localStorage.getItem('gto-reminder-time')
  if (!time) return

  const [hour, minute] = time.split(':').map(Number)
  const now = new Date()
  const lastReminder = localStorage.getItem('gto-reminder-last')
  const today = now.toDateString()

  if (now.getHours() === hour && now.getMinutes() === minute && lastReminder !== today) {
    localStorage.setItem('gto-reminder-last', today)
    new Notification('GTO Trainer', {
      body: '该训练了！每天练习保持手感。♠',
      icon: '/favicon.svg',
      tag: 'daily-reminder'
    })
  }
}

export function initReminder() {
  setInterval(checkReminder, 60000)
  checkReminder()
}
