'use client'

import { useEffect } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { MESSAGES } from '@/lib/messages'

interface ModalProps {
  title: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
}

export default function Modal({ title, children, onClose, wide = false }: ModalProps): ReactElement {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-2 sm:p-4"
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose()
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        className={`mx-auto my-2 w-full ${wide ? 'max-w-3xl' : 'max-w-md'} max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-lg bg-white p-4 shadow-lg sm:my-4 sm:max-h-[calc(100vh-2rem)] sm:p-6`}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
          <button type="button" onClick={onClose} className="text-sm text-zinc-500 hover:text-zinc-900" aria-label={MESSAGES.common.close}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
