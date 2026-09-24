import { useEffect } from 'react'
import { notify } from './notify'
import { apiFetch } from './api'

const STORAGE_KEY = 'mt_alerts_last_shown'
const ICONS = {
  production_drop: '📉',
  upcoming_birth:  '🐄',
  overdue_birth:   '⚠️',
  low_stock:       '📦',
}

export function useAlerts() {
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    const lastShown = localStorage.getItem(STORAGE_KEY)

    // Only run once per day
    if (lastShown === today) return

    const run = async () => {
      try {
        const alerts = await apiFetch('/alerts')
        if (!alerts?.length) return

        // Mark as shown for today before displaying
        localStorage.setItem(STORAGE_KEY, today)

        setTimeout(() => {
          alerts.forEach((alert, i) => {
            /* One toast style for the whole app, so a daily alert reads the
               same as the message a save puts up. Severity picks the tone
               rather than a palette of its own. */
            const show = alert.severity === 'high' ? notify.error : notify.warn
            setTimeout(() => show(`${ICONS[alert.type] || '🔔'} ${alert.message}`), i * 700)
          })
        }, 1500)
      } catch {
        // Silently fail — alerts are non-critical
      }
    }

    run()
  }, [])
}
