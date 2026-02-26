from pydantic import BaseModel

class ItemDto(BaseModel):
    name: str
    image: str
