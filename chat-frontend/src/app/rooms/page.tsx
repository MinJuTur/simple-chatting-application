// 채팅방 목록/생성 (username 유지)
"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { createRoom, listRooms, type Room } from "@/lib/api"
import { useRouter, useSearchParams } from "next/navigation"
import { Modal } from "../../components/Modal"


function RoomsContent() {
  const router = useRouter()
  const search = useSearchParams()
  const username = (search.get("user") || "").trim()

  const [rooms, setRooms] = useState<Room[]>([])
  const [loadingRooms, setLoadingRooms] = useState(false)

  const [newRoomName, setNewRoomName] = useState("")
  const [creatingRoom, setCreatingRoom] = useState(false)

  const [errorOpen, setErrorOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const canCreate = useMemo(() => newRoomName.trim().length > 0 && !creatingRoom, [newRoomName, creatingRoom])

  async function refreshRooms() {
    setLoadingRooms(true)
    try {
      const data = await listRooms()
      setRooms(data)
    } catch {
      setErrorMessage("방 목록을 불러오지 못했습니다. 백엔드가 켜져 있는지 확인해주세요.")
      setErrorOpen(true)
    } finally {
      setLoadingRooms(false)
    }
  }

  useEffect(() => {
    if (!username) {
      router.replace("/enter")
      return
    }
    refreshRooms()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username])

  async function handleCreateRoom() {
    const name = newRoomName.trim()
    if (!name) return

    setCreatingRoom(true)
    try {
      await createRoom(name)
      setNewRoomName("")
      await refreshRooms()
    } catch {
      setErrorMessage("채팅방 생성에 실패했습니다. 백엔드 상태를 확인해주세요.")
      setErrorOpen(true)
    } finally {
      setCreatingRoom(false)
    }
  }

  function goRoom(roomId: number) {
    router.push(`/rooms/${roomId}?user=${encodeURIComponent(username)}`)
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">채팅방 목록</h1>
            <p className="mt-1 text-sm text-gray-600">
              현재 사용자: <span className="font-semibold">{username}</span>
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => router.push("/enter")}
              className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
            >
              다른 유저로 입장
            </button>
            <button
              onClick={refreshRooms}
              className="rounded-xl bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600"
            >
              새로고침
            </button>
          </div>
        </div>

        <section className="mt-6 rounded-2xl border p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="text-sm text-gray-600">방을 선택해서 입장하거나, 새 방을 만들어보세요.</div>

            <div className="ml-auto flex w-full gap-2 md:w-auto">
              <input
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="새 방 이름"
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500/30 md:w-72"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateRoom()
                }}
              />
              <button
                disabled={!canCreate}
                onClick={handleCreateRoom}
                className="whitespace-nowrap rounded-xl bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-40"
              >
                {creatingRoom ? "생성 중..." : "방 만들기"}
              </button>
            </div>
          </div>

          <div className="mt-4">
            {loadingRooms ? (
              <p className="text-sm text-gray-500">불러오는 중...</p>
            ) : rooms.length === 0 ? (
              <p className="text-sm text-gray-500">아직 채팅방이 없습니다. 새로 만들어보세요!</p>
            ) : (
              <ul className="divide-y rounded-xl border">
                {rooms.map((r) => (
                  <li key={r.id} className="flex items-center justify-between p-3">
                    <div>
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-gray-500">room_id: {r.id}</div>
                    </div>
                    <button
                      onClick={() => goRoom(r.id)}
                      className="rounded-xl bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600"
                    >
                      입장
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
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

export default function RoomsPage() {
  return (
    <Suspense fallback={null}>
      <RoomsContent />
    </Suspense>
  )
}
