from pydantic import BaseModel, Field

class UserCreate(BaseModel):
    username: str = Field(min_length=1, max_length=50)

class UserOut(BaseModel):
    id: int
    username: str

    class Config:
        from_attributes = True  # pydantic v2

class RoomCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)

class RoomOut(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True

class MessageOut(BaseModel):
    id: int
    room_id: int
    user: str
    text: str
    created_at: str