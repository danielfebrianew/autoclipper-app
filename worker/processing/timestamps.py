"""
Timestamp snapping — port dari autoclipper-py/clip_generator/timestamps.py.

Setelah LLM mengusulkan batas clip, modul ini mengaudit tiap clip terhadap
snippet transcript mentah untuk memastikan:
  1. start di-snap mundur ke jeda kalimat sebelum kata pertama excerpt.
  2. end di-snap maju ke jeda kalimat setelah end_cue (atau kata terakhir excerpt).
  3. Jarak minimal PAD_SEC dari speech terdekat dipenuhi.
"""

import re
import logging

log = logging.getLogger("worker.processing.timestamps")

PAD_SEC = 1.5
MAX_SNAP_SEC = 8.0


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower().strip())


def _excerpt_boundary_words(excerpt: str, n: int = 6) -> tuple[list[str], list[str]]:
    words = _normalize(excerpt).split()
    words = [w for w in words if len(w) > 2]
    return words[:n], words[-n:]


def _find_first_match(snippets: list[dict], target_words: list[str], after_sec: float) -> float | None:
    for snip in snippets:
        start = float(snip.get("start", 0))
        if start < after_sec - MAX_SNAP_SEC:
            continue
        text = _normalize(snip.get("text", ""))
        if any(w in text for w in target_words):
            return start
    return None


def _find_last_match(snippets: list[dict], target_words: list[str], before_sec: float) -> float | None:
    best = None
    for snip in snippets:
        start = float(snip.get("start", 0))
        dur   = float(snip.get("duration", 2.0))
        end   = start + dur
        if start > before_sec + MAX_SNAP_SEC:
            continue
        text = _normalize(snip.get("text", ""))
        if any(w in text for w in target_words):
            best = end
    return best


def _sentence_end_after(snippets: list[dict], from_sec: float, max_look: float) -> float | None:
    relevant = [
        (float(s.get("start", 0)), float(s.get("duration", 2.0)))
        for s in snippets
        if float(s.get("start", 0)) >= from_sec - 1.0
    ]
    relevant.sort()
    for i in range(len(relevant) - 1):
        gap_start = relevant[i][0] + relevant[i][1]
        gap_end   = relevant[i + 1][0]
        gap       = gap_end - gap_start
        if gap >= PAD_SEC and gap_start >= from_sec:
            return gap_start + min(gap * 0.3, 0.5)
        if gap_start > from_sec + max_look:
            break
    return None


def _sentence_start_before(snippets: list[dict], from_sec: float, max_look: float) -> float | None:
    relevant = [
        (float(s.get("start", 0)), float(s.get("duration", 2.0)))
        for s in snippets
        if float(s.get("start", 0)) <= from_sec + 1.0
    ]
    relevant.sort()
    best = None
    for i in range(len(relevant) - 1):
        gap_start = relevant[i][0] + relevant[i][1]
        gap_end   = relevant[i + 1][0]
        gap       = gap_end - gap_start
        if gap >= PAD_SEC and gap_end <= from_sec:
            best = gap_end
        if gap_start < from_sec - max_look:
            continue
    return best


def snap_clip(clip: dict, snippets: list[dict], video_duration: float) -> dict:
    clip = dict(clip)
    adjustments: list[str] = []

    orig_start = float(clip.get("start_seconds") or 0)
    orig_end   = float(clip.get("end_seconds")   or 0)
    excerpt    = clip.get("transcript_excerpt") or ""
    end_cue    = clip.get("end_cue") or ""

    new_start = orig_start
    new_end   = orig_end

    if not snippets or not excerpt:
        clip["timestamp_adjustments"] = adjustments
        return clip

    first_words, last_words = _excerpt_boundary_words(excerpt)

    if end_cue:
        _, end_anchor_words = _excerpt_boundary_words(end_cue)
        end_anchor_label = f"end_cue '{end_cue[:40]}…'"
    else:
        end_anchor_words = last_words
        end_anchor_label = f"kata terakhir excerpt '{last_words[-1] if last_words else ''}'"

    # Snap start
    if first_words:
        match_start = _find_first_match(snippets, first_words, orig_start - MAX_SNAP_SEC)
        if match_start is not None:
            clean = _sentence_start_before(snippets, match_start, MAX_SNAP_SEC)
            candidate = clean if clean is not None else max(0.0, match_start - PAD_SEC)
            if abs(candidate - orig_start) > 0.5:
                adjustments.append(
                    f"start {orig_start:.1f}s → {candidate:.1f}s "
                    f"(kata pertama '{first_words[0]}' di {match_start:.1f}s)"
                )
                new_start = candidate
        else:
            log.warning("clip %s: kata pertama excerpt tidak ditemukan di transcript dekat %.1fs",
                        clip.get("clip_id"), orig_start)

    # Snap end
    if end_anchor_words:
        match_end = _find_last_match(snippets, end_anchor_words, orig_end + MAX_SNAP_SEC)
        if match_end is not None:
            clean = _sentence_end_after(snippets, match_end, MAX_SNAP_SEC)
            candidate = clean if clean is not None else min(video_duration, match_end + PAD_SEC)
            if candidate > orig_end or abs(candidate - orig_end) > 0.5:
                adjustments.append(
                    f"end {orig_end:.1f}s → {candidate:.1f}s ({end_anchor_label} berakhir di {match_end:.1f}s)"
                )
                new_end = candidate
        else:
            log.warning("clip %s: %s tidak ditemukan di transcript dekat %.1fs — end tidak disesuaikan",
                        clip.get("clip_id"), end_anchor_label, orig_end)

    # Sanity clamp
    new_start = max(0.0, new_start)
    new_end   = min(video_duration, new_end)
    if new_end - new_start < 5.0:
        log.warning("clip %s: durasi setelah snap terlalu pendek (%.1fs), pakai timestamp LLM",
                    clip.get("clip_id"), new_end - new_start)
        new_start = orig_start
        new_end   = orig_end
        adjustments.append("snap dibatalkan — hasil terlalu pendek, pakai timestamp LLM")

    def _fmt(sec: float) -> str:
        m, s = divmod(int(sec), 60)
        return f"{m:02d}:{s:02d}"

    clip["start_seconds"]        = int(new_start)
    clip["end_seconds"]          = int(new_end)
    clip["start_time"]           = _fmt(new_start)
    clip["end_time"]             = _fmt(new_end)
    clip["duration_seconds"]     = int(new_end - new_start)
    clip["timestamp_adjustments"] = adjustments
    return clip


def validate_and_snap(result: dict, snippets: list[dict]) -> dict:
    video_duration = float(result.get("video_duration_seconds") or 0)
    clips = result.get("clips") or []
    total_adjusted = 0

    for i, clip in enumerate(clips):
        snapped = snap_clip(clip, snippets, video_duration)
        adj = snapped.get("timestamp_adjustments") or []
        if adj:
            total_adjusted += 1
            log.info("clip %s — %d penyesuaian: %s",
                     clip.get("clip_id"), len(adj), " | ".join(adj))
        clips[i] = snapped

    log.info("%d dari %d clip disesuaikan timestampnya", total_adjusted, len(clips))
    result["clips"] = clips
    return result
