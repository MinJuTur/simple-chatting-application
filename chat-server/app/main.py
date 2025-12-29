# app/main.py
import json
import time
import asyncio
import contextlib
from typing import Any
from app.schemas import UserCreate, UserOut, RoomCreate, RoomOut, MessageOut

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, HTTPException, status
from app.redis_client import get_redis, create_redis

from app.db import SessionLocal
from app.models import User, Room, Message
from sqlalchemy import select

from typing import Generator
from fastapi import Depends
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
        
CHAT_CACHE_MAX = 50        # 최근 50개를 캐시로 저장
CHAT_CACHE_TTL = 60 * 60  # 캐시 TTL은 1시간(3600초)


app = FastAPI() # FastAPI 앱 생성

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


'''
Redis / Stream 관련 함수
'''

# redis 명령 실행
async def redis_execute(r, *args: str) -> Any: 
    if hasattr(r, "custom_command"):
        return await r.custom_command(list(args))
    if hasattr(r, "execute"):
        return await r.execute(list(args))
    if hasattr(r, "command"):
        return await r.command(list(args))
    raise RuntimeError("glide client: command method not found")
        
        
# Stream 키 생성
def stream_key(room_id: int) -> str: 
    return f"room:{room_id}:stream"


# Stream write
async def append_stream_message(r, room_id: int, payload: dict) -> str: 
    sk = stream_key(room_id)
    msg_json = json.dumps(payload, ensure_ascii=False)
    res = await redis_execute(r, "XADD", sk, "*", "msg", msg_json) # 새 메시지를 stream에 기록
    return str(res)


def _b2s(x: Any) -> str:
    if isinstance(x, (bytes, bytearray)):
        return x.decode()
    return str(x)

# XREAD 파싱
def parse_stream_entries(resp: Any) -> list[tuple[str, dict]]:
    """
    valkey-glide의 XREAD 응답 형태:
    {b'stream': {b'id': [[b'field', b'value'], ...], ...}}
    """
    out: list[tuple[str, dict]] = []
    if not resp:
        return out

    # resp가 dict 형태인 경우 처리
    if isinstance(resp, dict):
        for _sk, entries_dict in resp.items():
            # entries_dict: {entry_id: [[field, value], ...], ...}
            if not isinstance(entries_dict, dict):
                continue

            for entry_id_b, pairs in entries_dict.items():
                entry_id = _b2s(entry_id_b)

                # pairs: [[b'msg', b'{"...json..."}']] 같은 형태
                msg_json = None
                try:
                    for pair in pairs:
                        if len(pair) != 2:
                            continue
                        k = _b2s(pair[0])
                        v = pair[1]
                        if k == "msg":
                            msg_json = v.decode() if isinstance(v, (bytes, bytearray)) else str(v)
                            break
                except Exception:
                    continue

                if msg_json is None:
                    continue

                try:
                    payload = json.loads(msg_json)
                except Exception:
                    continue

                out.append((entry_id, payload))

        # entry_id 순서 보장(혹시라도 dict 순서에 의존하지 않게 정렬)
        out.sort(key=lambda x: x[0])
        return out

    # 혹시 다른 형태가 오면 일단 빈 리스트 반환
    return out


# Stream read loop
async def stream_listener(ws: WebSocket, r, room_id: int):
    last_id = "$" # 접속 이후 새 메시지만 받기

    while True:
        # last_id 이후로 새로 들어온 메시지
        resp = await redis_execute(
            r,
            "XREAD",
            "BLOCK", "5000", # 최대 5초까지 기다림
            "COUNT", "50",
            "STREAMS", stream_key(room_id), last_id,
        )
        
        items = parse_stream_entries(resp)
        
        for entry_id, payload in items:
            last_id = entry_id
            await ws.send_text(json.dumps(payload, ensure_ascii=False)) # ws으로 푸시
     
            
'''
Cache 관련 함수
'''

# Cache 키 생성
def cache_key(room_id: int) -> str:
    return f"room:{room_id}:recent"

            
# Cache write
async def cache_add_message(r, room_id: int, payload: dict) -> None:
    """
    활성 방의 최근 메시지를 Redis에 캐시
    """
    key = cache_key(room_id)
    msg_json = json.dumps(payload, ensure_ascii=False)

    # 최신 메시지를 앞에 추가
    await redis_execute(r, "LPUSH", key, msg_json)

    # 최근 50개만 유지
    await redis_execute(r, "LTRIM", key, "0", str(CHAT_CACHE_MAX - 1))

    # TTL 갱신 (활성 방만 캐시 유지)
    await redis_execute(r, "EXPIRE", key, str(CHAT_CACHE_TTL))
 

# Cache read
async def cache_get_messages(r, room_id: int) -> list[dict]:
    """
    Redis 캐시에서 최근 메시지 50개 읽기
    (없으면 빈 리스트 반환)
    """
    key = cache_key(room_id)

    # 0 ~ 49 (LPUSH 구조이므로 최신 → 과거 순서)
    raw = await redis_execute(r, "LRANGE", key, "0", str(CHAT_CACHE_MAX - 1))
    if not raw:
        return []

    messages: list[dict] = []

    # Redis → Python dict 변환
    for item in raw:
        try:
            if isinstance(item, (bytes, bytearray)):
                item = item.decode()
            messages.append(json.loads(item))
        except Exception:
            continue

    # 시간 순서(과거 → 최신)로 뒤집기
    messages.reverse()
    return messages
    
'''
DB 관련 함수
'''

# db에서 user 조회
def db_get_or_create_user(db, username: str) -> int:
    user = db.execute(select(User).where(User.username == username)).scalar_one_or_none()
    if user:
        return user.id
    user = User(username=username)
    db.add(user)
    db.flush()  # INSERT 후 user.id 확보
    return user.id


# db에서 room 조회
def db_get_room_or_404(db: Session, room_id: int) -> int:
    room = db.get(Room, room_id)
    # 채팅방이 없으면 예외 발생
    if not room: 
        raise ValueError("room_not_found")
    return room.id 


# room이 생성됐는지 확인
def _check_room_or_raise(room_id: int) -> None:
    db = SessionLocal()
    try:
        db_get_room_or_404(db, room_id)
    finally:
        db.close()


# DB에 메시지 저장
def db_save_message(room_id: int, username: str, text: str) -> dict:
    """
    DB에 메시지 저장하고, 저장된 메시지의 핵심 정보(id/created_at 등)를 dict로 반환.
    """
    db = SessionLocal()
    try:
        # user_id가 이미 존재하면 가져오고 없으면 새로 생성
        uid = db_get_or_create_user(db, username)
        # 채팅방이 없으면 예외 발생, 존재해야 가져옴
        rid = db_get_room_or_404(db, room_id)

        m = Message(room_id=rid, user_id=uid, content=text)
        db.add(m)
        db.commit()
        db.refresh(m)

        return {
            "db_message_id": m.id,
            "db_created_at": m.created_at.isoformat() if m.created_at else None,
            "db_user_id": uid,
            "db_room_id": rid,
        }
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


# db 메시지 조회
def db_get_messages(room_id: int, limit: int = 50) -> list[dict]:
    """
    DB에서 해당 방의 최근 메시지 limit개 조회
    (과거 → 최신 순서로 반환)
    """
    db = SessionLocal()
    try:
        rows = (
            db.execute(
                select(Message, User.username)
                .join(User, User.id == Message.user_id)
                .where(Message.room_id == room_id)
                .order_by(Message.created_at.desc())
                .limit(limit)
            )
            .all()
        )

        messages: list[dict] = []
        for msg, username in rows:
            messages.append({
                "type": "message",
                "room_id": room_id,
                "user": username,
                "text": msg.content,
                "ts": msg.created_at.timestamp() if msg.created_at else None,
                "db_message_id": msg.id,
            })

        # DB는 최신 → 과거로 가져오므로 뒤집어서 반환
        messages.reverse()
        return messages

    finally:
        db.close()


'''
WebSocket 흐름 관련 함수
'''

# 최근 메시지 50개 조회
async def send_chat_history(ws: WebSocket, *, r_read, r_write, room_id: int) -> None:
    # Redis 캐시에서 최근 메시지 시도
    cached = await cache_get_messages(r_read, room_id)

    # 1) 캐시가 있으면 캐시 먼저 전송
    if cached:
        for msg in cached:
            await ws.send_text(json.dumps(msg, ensure_ascii=False))
        return
    
    # 2) 캐시가 없으면 DB에서 최근 50개 조회
    recent = await asyncio.to_thread(db_get_messages, room_id, CHAT_CACHE_MAX)
    
    for msg in recent:
        await ws.send_text(json.dumps(msg, ensure_ascii=False))

    # DB 결과로 Redis 캐시 업데이트(최신부터)
    for msg in reversed(recent):
        await cache_add_message(r_write, room_id, msg) 
        

# 연결 성공 확인용
@app.get("/health")
async def health():
    r = await get_redis()
    pong = await redis_execute(r, "PING")
    return {"ok": True, "redis": str(pong)}


# WS 엔드포인트    
@app.websocket("/ws/{room_id}")
async def ws_chat_room(ws: WebSocket, room_id: int, user: str = Query(default="anonymous")):
    # 웹 소켓 연결 승인
    await ws.accept()
    
    # 채팅방을 먼저 생성해야만 /ws/{room_id}로 채팅 가능
    try:
        await asyncio.to_thread(_check_room_or_raise, room_id)
    except ValueError as e:
        if str(e) == "room_not_found":
            await ws.close(code=1008, reason="room not found")
            return
        raise
     
    # redis 클라이언트 가져오기
    r_write = await get_redis()     # write 용도(공유)
    r_read = await create_redis()    # read 용도(이 연결 전용)

    # 최근 메시지 50개 조회
    await send_chat_history(ws, r_read=r_read, r_write=r_write, room_id=room_id)
    
    # 다른 사람들이 보내는 메시지 실시간 받기(백그라운드 실행)
    reader_task = asyncio.create_task(stream_listener(ws, r_read, room_id)) 

    try:
        # 채팅방 접속 시 join 메시지가 Redis stream에 기록됨
        await append_stream_message(r_write, room_id, {
            "type": "system",
            "room_id": room_id,
            "user": user,
            "text": f"{user} joined",
            "ts": time.time(),
        })

        while True:
            # 내 클라이언트가 보내는 메시지 받기
            text = await ws.receive_text() 
            
            try:
                # DB 저장
                meta = await asyncio.to_thread(db_save_message, room_id, user, text)
            except ValueError as e:
                if str(e) == "room_not_found":
                    await ws.close(code=1008, reason="room not found")
                    return
                raise
            
            # 메시지가 Redis stream에 기록됨
            payload = {
                "type": "message",
                "room_id": room_id,
                "user": user,
                "text": text,
                "ts": time.time(),
                **meta,  # 프론트 작업 시 메시지 식별에 도움
            }
            await append_stream_message(r_write, room_id, payload)
            
            # cache 갱신
            await cache_add_message(r_write, room_id, payload)

    except WebSocketDisconnect:
        await append_stream_message(r_write, room_id, {
            "type": "system",
            "room_id": room_id,
            "user": user,
            "text": f"{user} left",
            "ts": time.time(),
        })

    finally:
        reader_task.cancel()
        
        with contextlib.suppress(asyncio.CancelledError, Exception): # CancelledError는 정상이므로 suppress 대상에 포함
            await reader_task
        
        # glide에 close가 있으면 닫기
        if hasattr(r_read, "close"):
            with contextlib.suppress(Exception):
                await r_read.close()   
          


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# 유저 생성 API
@app.post("/users", response_model=UserOut, status_code=201)
def create_user(body: UserCreate, db: Session = Depends(get_db)):
    # 같은 username이 DB에 있는지 조회
    exists = db.execute(select(User).where(User.username == body.username)).scalar_one_or_none()
    if exists:
        raise HTTPException(status_code=409, detail="username already exists")

    u = User(username=body.username)
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


# 유저 존재 확인 API
@app.get("/users/{username}", response_model=UserOut)
def get_user(username: str, db: Session = Depends(get_db)):
    user = db.execute(select(User).where(User.username == username)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="user not found")
    return user


# 방 생성 API
@app.post("/rooms", response_model=RoomOut, status_code=201)
def create_room(body: RoomCreate, db: Session = Depends(get_db)):
    r = Room(name=body.name)
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


# 방 목록 조회 API
@app.get("/rooms", response_model=list[RoomOut])
def list_rooms(db: Session = Depends(get_db)):
    # rooms 테이블에서 최신 순으로 최대 100개 조회
    rooms = db.execute(select(Room).order_by(Room.id.desc()).limit(100)).scalars().all()
    return rooms


# 방 조회 API
@app.get("/rooms/{room_id}", response_model=RoomOut)
def get_room(room_id: int, db: Session = Depends(get_db)):
    # DB에서 해당 room이 있는지 확인
    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="room not found")
    return room


# 메시지 조회 API
@app.get("/rooms/{room_id}/messages", response_model=list[MessageOut])
def get_room_messages(room_id: int, limit: int = 50, db: Session = Depends(get_db)):
    # 방 존재 확인
    room = db.get(Room, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="room not found")

    rows = (
        db.execute(
            select(Message, User.username)
            .join(User, User.id == Message.user_id)
            .where(Message.room_id == room_id)
            .order_by(Message.created_at.desc())
            .limit(min(limit, 50))
        )
        .all()
    )

    out = []
    for msg, username in rows:
        out.append({
            "id": msg.id,
            "room_id": room_id,
            "user": username,
            "text": msg.content,
            "created_at": msg.created_at.isoformat() if msg.created_at else "",
        })

    out.reverse()  # 과거→최신
    return out
        
