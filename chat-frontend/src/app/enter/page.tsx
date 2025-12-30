// 유저 입장 화면
"use client"

import { Suspense, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { getUser } from "@/lib/api"
import { Modal } from "../../components/Modal"

function EnterForm() {
  const router = useRouter()
  const search = useSearchParams()
  const prefill = (search.get("prefill") || "").trim()

  const [username, setUsername] = useState(prefill)
  const [loading, setLoading] = useState(false)

  const [errorOpen, setErrorOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const [suggestSignupOpen, setSuggestSignupOpen] = useState(false)

  const canEnter = useMemo(() => username.trim().length >= 2 && !loading, [username, loading])

  async function enter() {
    const name = username.trim()
    if (!name) return

    setLoading(true)
    try {
      await getUser(name)
      router.push(`/rooms?user=${encodeURIComponent(name)}`)
    } catch (e: any) {
      if (e?.status === 404) {
        setSuggestSignupOpen(true)
      } else {
        setErrorMessage("유저 확인에 실패했어요. 백엔드 상태를 확인해주세요.")
        setErrorOpen(true)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-2xl p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">유저 입장</h1>
          <button onClick={() => router.push("/")} className="rounded-xl px-3 py-2 text-sm hover:bg-gray-100">
            홈으로
          </button>
        </div>

        <section className="mt-6 rounded-2xl border p-5">
          <p className="text-sm text-gray-600">등록된 username을 입력하면 채팅방 목록으로 이동해요.</p>

          <div className="mt-3 flex gap-2">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="예: alice"
              className="w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/30"
              onKeyDown={(e) => {
                if (e.key === "Enter") enter()
              }}
            />
            <button
              disabled={!canEnter}
              onClick={enter}
              className="whitespace-nowrap rounded-xl py-2 font-medium text-white hover:bg-brand-600 disabled:opacity-40 bg-popover-foreground px-5"
            >
              {loading ? "확인 중..." : "입장"}
            </button>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={() => router.push(`/signup?prefill=${encodeURIComponent(username.trim())}`)}
              className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
            >
              유저가 없습니까? -&gt; 새 유저 생성하기
            </button>
          </div>
        </section>

        <Modal open={suggestSignupOpen} title="등록되지 않은 username" onClose={() => setSuggestSignupOpen(false)}>
          <div className="space-y-3">
            <p className="text-sm">
              <span className="font-semibold">{username.trim()}</span> 는(은) 등록되지 않았습니다. 유저 생성 화면으로
              이동할까요?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setSuggestSignupOpen(false)}
                className="flex-1 rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={() => router.push(`/signup?prefill=${encodeURIComponent(username.trim())}`)}
                className="flex-1 rounded-xl bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600"
              >
                유저 생성으로
              </button>
            </div>
          </div>
        </Modal>

        <Modal open={errorOpen} title="오류" onClose={() => setErrorOpen(false)}>
          <div className="space-y-2">
            <p>{errorMessage}</p>
            <p className="text-xs text-gray-500">백엔드가 127.0.0.1:8000에서 실행 중인지 확인해줘.</p>
          </div>
        </Modal>
      </div>
    </main>
  )
}

export default function EnterPage() {
  return (
    <Suspense fallback={null}>
      <EnterForm />
    </Suspense>
  )
}
