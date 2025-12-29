# app/redis_client.py
import os
from dataclasses import dataclass
from dotenv import load_dotenv

from glide import GlideClient, GlideClientConfiguration, NodeAddress

load_dotenv()

@dataclass(frozen=True)
class RedisSettings:
    host: str = os.getenv("REDIS_HOST", "127.0.0.1")
    port: int = int(os.getenv("REDIS_PORT", "6379"))
    db: int = int(os.getenv("REDIS_DB", "0"))

_redis_client: GlideClient | None = None

# 새 연결 생성 함수
async def create_redis() -> GlideClient:
    s = RedisSettings()
    config = GlideClientConfiguration(
        addresses=[NodeAddress(host=s.host, port=s.port)],
        database_id=s.db,
    )
    return await GlideClient.create(config)

async def get_redis() -> GlideClient:
    global _redis_client
    if _redis_client is not None:
        return _redis_client

    s = RedisSettings()
    config = GlideClientConfiguration(
        addresses=[NodeAddress(host=s.host, port=s.port)],
        database_id=s.db,
    )
    _redis_client = await GlideClient.create(config)
    return _redis_client

