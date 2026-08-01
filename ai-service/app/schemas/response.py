from __future__ import annotations
from typing import Any

from pydantic import BaseModel, Field


class APIResponse(BaseModel):
    success: bool = True
    message: str = ""
    data: Any = Field(default_factory=dict)
    traceId: str = ""

    class Config:
        arbitrary_types_allowed = True

    @classmethod
    def success_response(
        cls,
        message: str = "",
        data: Any | None = None,
        trace_id: str = "",
    ) -> "APIResponse":
        return cls(success=True, message=message, data=data or {}, traceId=trace_id)


class ErrorResponse(BaseModel):
    success: bool = False
    message: str = ""
    errors: list[str] = Field(default_factory=list)
    traceId: str = ""

    class Config:
        arbitrary_types_allowed = True
