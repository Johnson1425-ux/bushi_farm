import { useEffect } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { apiFetch } from './api'

const ICONS = {
  production_drop: '📉',
  upcoming_birth:  '🐄',
  low_stock:       '📦',
}

const COLORS = {
  high:   { background: '#fde8e8', color: '#8a1c1c', border: '1px solid #f5c0c0' },
  medium: { background: '#fff4de', color: '#7a4800', border: '1px solid #f5d88a' },
}

export function useAlerts() {
  useEffect(() => {
    const run = async () => {
      try {
        const alerts = await apiFetch('/alerts/daily')
        if (!alerts?.length) return

        // Small delay so toasts appear after page load
        setTimeout(() => {
          alerts.forEach((alert, i) => {
            const style = COLORS[alert.severity] || COLORS.medium
            setTimeout(() => {
              toast(
                `${ICONS[alert.type] || '⚠️'} ${alert.message}`,
                {
                  duration: alert.severity === 'high' ? 8000 : 5000,
                  style: { ...style, fontSize: 13, fontFamily: "'Outfit', sans-serif", maxWidth: 360 },
                  position: 'top-right',
                }
              )
            }, i * 600)
          })
        }, 1500)
      } catch (e) {
        // Silently fail — alerts are non-critical
      }
    }
    run()
  }, [])
}

export { Toaster }