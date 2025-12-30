// lib/api.ts - API helper functions

const BASE_URL = "http://127.0.0.1:8000"

export interface Room {
  id: number
  name: string
}

export async function createUser(username: string) {
  const res = await fetch(`${BASE_URL}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    if (res.status === 409 || data.detail === "username already exists") {
      throw { message: "USERNAME_TAKEN" }
    }
    throw new Error("Failed to create user")
  }
  return res.json()
}

export async function getUser(username: string) {
  const res = await fetch(`${BASE_URL}/users/${username}`)
  if (!res.ok) {
    throw { status: res.status }
  }
  return res.json()
}

export async function listRooms(): Promise<Room[]> {
  const res = await fetch(`${BASE_URL}/rooms`)
  if (!res.ok) throw new Error("Failed to list rooms")
  return res.json()
}

export async function createRoom(name: string) {
  const res = await fetch(`${BASE_URL}/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error("Failed to create room")
  return res.json()
}

export function wsUrl(roomId: number, username: string) {
  return `ws://127.0.0.1:8000/ws/${roomId}?user=${encodeURIComponent(username)}`
}
