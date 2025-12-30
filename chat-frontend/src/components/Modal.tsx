"use client"

import { type ReactNode, useEffect } from "react"

export function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* backdrop */}
      <button aria-label="close" onClick={onClose} className="absolute inset-0 bg-black/30" />

      {/* panel */}
      <div className="relative w-[92vw] max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-sm text-gray-600 hover:bg-gray-100">
            닫기
          </button>
        </div>
        <div className="text-sm text-gray-700">{children}</div>
      </div>
    </div>
  )
}
