from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from pydantic import BaseModel


class Face(BaseModel):
    cx: float
    cy: float
    area: float
    conf: float
    box: tuple[float, float, float, float]  # x1, y1, x2, y2

    @property
    def score(self) -> float:
        return self.area * (0.75 + self.conf)

    def asd_score(self, asd_scores: dict | None, radius_px: float = 50.0) -> float:
        if not asd_scores:
            return 0.0
        key = round(self.cx)
        best = 0.0
        for cx_key, prob in asd_scores.items():
            if abs(cx_key - key) < radius_px:
                best = max(best, prob)
        return best

    def weighted_score(self, asd_scores: dict | None = None) -> float:
        return self.score * (1.0 + 2.0 * self.asd_score(asd_scores))


@dataclass
class FocusTrackerState:
    current_cx: Optional[float] = None
    current_area: float = 0.0
    last_seen_frame: int = field(default_factory=lambda: -(10**9))
    lock_until_frame: int = -1
    pending_cx: Optional[float] = None
    pending_since_frame: Optional[int] = None
    prev_sample_frame: int = -1

    def is_locked(self, frame_idx: int) -> bool:
        return frame_idx < self.lock_until_frame

    def lost_too_long(self, frame_idx: int, grace_frames: int) -> bool:
        return frame_idx - self.last_seen_frame > grace_frames

    def reset_pending(self) -> None:
        self.pending_cx = None
        self.pending_since_frame = None

    def lock(self, frame_idx: int, min_lock_frames: int) -> None:
        self.lock_until_frame = frame_idx + min_lock_frames
        self.reset_pending()
