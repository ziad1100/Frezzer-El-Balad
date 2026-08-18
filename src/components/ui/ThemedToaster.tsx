import { Toaster } from 'sonner'
import { useAppSelector } from '@/hooks'

export function ThemedToaster() {
  const theme = useAppSelector((state) => state.ui.theme)
  return (
    <Toaster
      position="top-center"
      theme={theme}
      toastOptions={{
        style: {
          background: 'var(--color-night-900)',
          color: 'var(--color-night-100)',
          border: '1px solid var(--color-night-700)',
        },
      }}
    />
  )
}
