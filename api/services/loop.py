"""One client instance per asyncio event loop.

httpx / Gemini async clients are bound to the loop that first used them. A process can see several
loops (test clients, serverless runtimes that start a loop per request), so reuse a client only
within its own loop.
"""

import asyncio
from typing import Callable, Generic, TypeVar

T = TypeVar("T")


class PerLoop(Generic[T]):
    def __init__(self, factory: Callable[[], T]):
        self._factory = factory
        self._loop: asyncio.AbstractEventLoop | None = None
        self._value: T | None = None

    def get(self) -> T:
        loop = asyncio.get_running_loop()
        if self._value is None or self._loop is not loop:
            self._value = self._factory()
            self._loop = loop
        return self._value
