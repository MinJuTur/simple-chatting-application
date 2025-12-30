// 채팅 화면
"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { wsUrl } from "@/lib/api"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { Modal } from "../../../components/Modal"


type ChatMsg = {
  type: "message" | "system"
  room_id: number
  user: string
  text: string
  ts?: number
  db_message_id?: number
}

function RoomContent() {
  const router = useRouter()
  const params = useParams<{ roomId: string }>()
  const search = useSearchParams()

  const roomId = Number(params.roomId)
  const username = (search.get("user") || "").trim()

  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState("")

  const [status, setStatus] = useState<"connecting" | "open" | "closed" | "error">("connecting")

  const [errorOpen, setErrorOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const wsRef = useRef<WebSocket | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const openedOnceRef = useRef(false)

  const canSend = useMemo(() => input.trim().length > 0 && status === "open", [input, status])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  useEffect(() => {
    if (!roomId || !Number.isFinite(roomId)) {
      setErrorMessage("roomId가 올바르지 않습니다.")
      setErrorOpen(true)
      return
    }
    if (!username) {
      router.replace("/enter")
      return
    }

    let ignore = false
    const url = wsUrl(roomId, username)
    const ws = new WebSocket(url)
    wsRef.current = ws

    setStatus("connecting")
    openedOnceRef.current = false

    ws.onopen = () => {
      if (ignore) return
      openedOnceRef.current = true
      setStatus("open")
    }

    ws.onmessage = (ev) => {
      if (ignore) return
      try {
        const msg = JSON.parse(ev.data) as ChatMsg
        setMessages((prev) => [...prev, msg])
      } catch {
        // ignore
      }
    }

    ws.onclose = () => {
      if (ignore) return
      setStatus("closed")
    }

    ws.onerror = () => {
      if (ignore) return

      if (openedOnceRef.current) return

      if (ws.readyState === WebSocket.OPEN) return

      setStatus("error")
      setErrorMessage("WebSocket 연결에 실패했습니다. 백엔드 실행/주소를 확인해주세요.")
      setErrorOpen(true)
    }

    return () => {
      ignore = true
      try {
        ws.close()
      } catch {}
      wsRef.current = null
    }
  }, [roomId, username, router])

  function send() {
    const text = input.trim()
    if (!text) return
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(text)
    setInput("")
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto flex max-w-3xl flex-col p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Room #{roomId}</h1>
            <div className="text-sm text-gray-600">
              user: <span className="font-semibold">{username}</span> · 상태:{" "}
              <span className="font-semibold">{status}</span>
            </div>
          </div>

          <button
            onClick={() => router.push(`/rooms?user=${encodeURIComponent(username)}`)}
            className="rounded-xl bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            채팅방 목록으로
          </button>
        </div>

        <div className="h-[65vh] overflow-y-auto rounded-2xl border bg-white p-3">
          {messages.length === 0 ? (
            <div className="mt-6 text-center text-sm text-gray-500">
              아직 채팅방에 메시지가 없습니다.
            </div>
          ) : (
            <div className="space-y-2">
              {messages.map((m, idx) => {
                const isMe = m.user === username && m.type === "message"
                const isSystem = m.type === "system"

                return (
                  <div
                    key={`${m.ts ?? "x"}-${m.db_message_id ?? "y"}-${idx}`}
                    className={["flex", isSystem ? "justify-center" : isMe ? "justify-end" : "justify-start"].join(" ")}
                  >
                    <div
                      className={[
                        "max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                        isSystem
                          ? "bg-gray-100 text-gray-600"
                          : isMe
                            ? "bg-bubble-meBg text-bubble-meText"
                            : "bg-bubble-otherBg text-bubble-otherText",
                      ].join(" ")}
                    >
                      {!isSystem && <div className="mb-1 text-xs font-semibold opacity-80">{m.user}</div>}
                      <div className="whitespace-pre-wrap break-words">{m.text}</div>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send()
            }}
            placeholder="메시지 입력..."
            className="w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/30"
          />
          <button
            disabled={!canSend}
            onClick={send}
            className="rounded-xl bg-brand-500 px-4 py-2 font-medium text-white hover:bg-brand-600 disabled:opacity-40"
          >
            전송
          </button>
        </div>
      </div>

      <Modal open={errorOpen} title="오류" onClose={() => setErrorOpen(false)}>
        <div className="space-y-2">
          <p>{errorMessage}</p>
          <p className="text-xs text-gray-500">백엔드가 127.0.0.1:8000에서 실행 중인지 확인해주세요.</p>
        </div>
      </Modal>
    </main>
  )
}

export default function RoomPage() {
  return (
    <Suspense fallback={null}>
      <RoomContent />
    </Suspense>
  )
}
