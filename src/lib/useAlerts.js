import { useEffect } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { apiFetch } from './api'

const STORAGE_KEY = 'mt_alerts_last_shown'
const ICONS = {
  production_drop: '📉',
  upcoming_birth:  '🐄',
  overdue_birth:   '⚠️',
  low_stock:       '📦',
}
const COLORS = {
  high:   { background: '#fde8e8', color: '#8a1c1c', border: '1px solid #f5c0c0' },
  medium: { background: '#fff4de', color: '#7a4800', border: '1px solid #f5d88a' },
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
            const style = COLORS[alert.severity] || COLORS.medium
            setTimeout(() => {
              toast(
                `${ICONS[alert.type] || '🔔'} ${alert.message}`,
                {
                  duration: alert.severity === 'high' ? 8000 : 5000,
                  style: {
                    ...style,
                    fontSize: 13,
                    fontFamily: "'Outfit', sans-serif",
                    maxWidth: 360,
                  },
                }
              )
            }, i * 700)
          })
        }, 1500)
      } catch {
        // Silently fail — alerts are non-critical
      }
    }

    run()
  }, [])
}

export { Toaster }