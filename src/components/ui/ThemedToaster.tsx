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
          background: 'var(--tw-surface)',
          color: 'var(--tw-text)',
          border: '1px solid var(--tw-border-strong)',
        },
      }}
    />
  )
}
