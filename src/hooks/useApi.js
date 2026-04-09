import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../lib/api'

export function useApi(path, deps = []) {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  const fetch = useCallback(async () => {
    if (!path) return
    setLoading(true)
    setError(null)
    try {
      const d = await apiFetch(path)
      setData(d)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps])

  useEffect(() => { fetch() }, [fetch])

  return { data, loading, error, refetch: fetch }
}
