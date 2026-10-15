"""Tiny in-process TTL cache.

Summaries are cached here per warm serverless instance (plus Vercel's CDN via Cache-Control).
Firestore (`recallSummaries/{recallNumber}`) replaces this once Firebase is wired up.
"""

import time
from collections import OrderedDict
from typing import Generic, TypeVar

T = TypeVar("T")


class TTLCache(Generic[T]):
    def __init__(self, maxsize: int = 2000, ttl_seconds: float = 24 * 3600):
        self._data: OrderedDict[str, tuple[float, T]] = OrderedDict()
        self._maxsize = maxsize
        self._ttl = ttl_seconds

    def get(self, key: str) -> T | None:
        entry = self._data.get(key)
        if entry is None:
            return None
        expires, value = entry
        if expires < time.monotonic():
            del self._data[key]
            return None
        self._data.move_to_end(key)
        return value

    def set(self, key: str, value: T) -> None:
        self._data[key] = (time.monotonic() + self._ttl, value)
        self._data.move_to_end(key)
        while len(self._data) > self._maxsize:
            self._data.popitem(last=False)
