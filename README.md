# Simple Chatting Application

WebSocket과 Redis를 활용한 **실시간 채팅 애플리케이션**입니다.

---

## Overview

이 프로젝트는 실시간 채팅 서비스의 기본 구조를 이해하고,  
**WebSocket · Redis · 캐시 전략 · DB 연동**을 직접 구현해보기 위해 제작되었습니다.

주요 목표는 다음과 같습니다.

- 다중 유저 환경에서의 실시간 메시지 처리
- 채팅방 단위 메시지 관리
- Redis 캐시 + DB fallback 구조 설계
- 프론트엔드 / 백엔드 분리 아키텍처 이해

---

## Tech Stack

### Backend
- Python
- FastAPI
- WebSocket
- Redis (Stream, List, TTL)
- PostgreSQL
- SQLAlchemy

### Frontend
- Next.js (App Router)
- TypeScript
- Tailwind CSS

### Others
- Poetry
- Node.js

---

## Project Structure

simple-chatting-application/
├─ chat-server/        # FastAPI backend
│  ├─ app/
│  ├─ models/
│  ├─ redis_client.py
│  └─ main.py
│
├─ chat-frontend/      # Next.js frontend
│  ├─ src/
│  ├─ app/
│  ├─ components/
│  └─ lib/


## Features
🔹 User
- username 생성

- username 중복 방지

- 기존 유저 입장 시 존재 여부 확인

🔹 Chat Room
- 채팅방 생성

- 채팅방 목록 조회

- 특정 채팅방 입장

🔹 Real-time Chat
- WebSocket 기반 실시간 메시지 송수신

- Redis Stream을 이용한 메시지 브로드캐스트

🔹 Message Cache
- 활성 채팅방의 최근 50개 메시지를 Redis에 캐시

- TTL 만료 시 DB에서 최근 메시지 조회

- 캐시 미스 시 자동 warm-up

## Message Flow & Cache Strategy
1. 클라이언트가 채팅방에 입장

2. Redis 캐시에서 최근 50개 메시지 조회

- Cache HIT → 즉시 전송

- Cache MISS → DB 조회 후 캐시 갱신

3. 새 메시지 전송 시

- DB에 영구 저장

- Redis Stream에 기록

- Redis List 캐시 갱신 (LPUSH + LTRIM + EXPIRE)

## How to Run
### Backend
bash
코드 복사
cd chat-server
poetry install
poetry run uvicorn app.main:app --reload --port 8000

### Frontend
bash
코드 복사
cd chat-frontend
npm install
npm run dev

- Backend: http://127.0.0.1:8000
- Frontend: http://localhost:3000

## UI Pages
- Home

- User Signup

- User Enter

- Chat Room List & Create

- Chat Room (Real-time)

※ 스크린샷은 추후 추가 예정

## Future Improvements
- 인증 (JWT)

- 메시지 읽음 처리

- 채팅방 멤버 관리

- 배포 (Docker + Vercel)
