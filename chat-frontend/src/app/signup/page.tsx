// src/app/signup/page.tsx
// 유저 생성
"use client"

import { Suspense, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createUser } from "@/lib/api"
import { Modal } from "../../components/Modal"


function SignupForm() {
  const router = useRouter()
  const search = useSearchParams()
  const prefill = (search.get("prefill") || "").trim()

  const [username, setUsername] = useState(prefill)
  const [loading, setLoading] = useState(false)

  const [done, setDone] = useState(false)

  const [errorOpen, setErrorOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const canSubmit = useMemo(() => username.trim().length >= 2 && !loading, [username, loading])

  async function submit() {
    const name = username.trim()
    if (!name) return

    setLoading(true)
    try {
      await createUser(name)
      setDone(true)
    } catch (e: any) {
      if (e?.message === "USERNAME_TAKEN") {
        setErrorMessage("이미 사용 중인 username 입니다. 다른 이름으로 등록해주세요!")
      } else {
        setErrorMessage("유저 생성에 실패했습니다. 백엔드 상태를 확인해주세요.")
      }
      setErrorOpen(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-2xl p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">유저 생성</h1>
          <button onClick={() => router.push("/")} className="rounded-xl px-3 py-2 text-sm hover:bg-gray-100">
            홈으로
          </button>
        </div>

        <section className="mt-6 rounded-2xl border p-5">
          <p className="text-sm text-gray-600">사용할 username을 입력하고 등록하세요. (중복 불가)</p>

          <div className="mt-3 flex gap-2">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="예: alice"
              className="w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-brand-500/30"
            />
            <button
              disabled={!canSubmit}
              onClick={submit}
              className="rounded-xl py-2 font-medium text-white hover:bg-brand-600 disabled:opacity-40 bg-popover-foreground px-5 whitespace-nowrap"
            >
              {loading ? "생성 중..." : "생성"}
            </button>
          </div>

          {done && (
            <div className="mt-4 rounded-xl bg-bubble-meBg px-4 py-3 text-sm text-bubble-meText">
              등록 완료! 이제 이 username으로 입장할 수 있어요.
              <div className="mt-3">
                <button
                  onClick={() => router.push(`/enter?prefill=${encodeURIComponent(username.trim())}`)}
                  className="rounded-xl bg-brand-500 px-4 py-2 font-medium text-white hover:bg-brand-600"
                >
                  유저 입장 화면으로 이동
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={() => router.push("/enter")}
              className="border px-3 py-2 text-sm hover:bg-gray-50 rounded-lg"
            >
              이미 유저가 있어요 → 입장하기
            </button>
          </div>
        </section>

        <Modal open={errorOpen} title="오류" onClose={() => setErrorOpen(false)}>
          <div className="space-y-2">
            <p>{errorMessage}</p>
            <p className="text-xs text-gray-500">백엔드: http://127.0.0.1:8000 (poetry run uvicorn ... --port 8000)</p>
          </div>
        </Modal>
      </div>
    </main>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  )
}
