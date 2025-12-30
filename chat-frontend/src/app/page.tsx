// src/app/page.tsx
// 홈 화면 코드
"use client"

import { useRouter } from "next/navigation"

export default function HomePage() {
  const router = useRouter()

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-3xl font-bold">Simple Chat Application  </h1>
        <p className="mt-2 text-gray-600">
          실시간 채팅을 시작할까요? 먼저 유저를 만들거나, 이미 만든 유저로 입장할 수 있어요.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border p-5">
            <h2 className="text-lg font-semibold">새 유저 등록</h2>
            <p className="mt-2 text-sm text-gray-600">
              처음 이용한다면 username을 새로 등록하세요. 중복 username은 사용할 수 없어요.
            </p>
            <button
              onClick={() => router.push("/signup")}
              className="mt-4 w-full rounded-xl px-4 py-2 font-medium text-white hover:bg-brand-600 bg-popover-foreground"
            >
              {"유저 등록"}
            </button>
          </div>

          <div className="rounded-2xl border p-5">
            <h2 className="text-lg font-semibold">기존 유저로 입장</h2>
            <p className="mt-2 text-sm text-gray-600">
              이미 등록한 username이 있다면 바로 입장해서 채팅방 목록을 볼 수 있어요.
            </p>
            <button
              onClick={() => router.push("/enter")}
              className="mt-4 w-full rounded-xl px-4 py-2 font-medium text-white hover:bg-brand-600 bg-popover-foreground"
            >
              유저 입장
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
