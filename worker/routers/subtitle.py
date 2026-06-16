import logging
import os
from pathlib import Path
from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException

logger = logging.getLogger("worker.subtitle")
router = APIRouter()

WORDS_PER_LINE = 4

# --- Caption preset styles (ASS) ---
# Each preset defines: fontsize, bold, primary_color, highlight_color, outline, shadow, box (back_color)
PRESETS = {
    "bold": {
        "fontsize": 85, "bold": -1,
        "primary": "&H00FFFFFF", "highlight": "&H0000FFFF",
        "outline": 4, "shadow": 2, "back_color": "&H00000000",
        "border_style": 1,
    },
    "clean": {
        "fontsize": 75, "bold": 0,
        "primary": "&H00FFFFFF", "highlight": "&H00FFFF00",
        "outline": 2, "shadow": 0, "back_color": "&H00000000",
        "border_style": 1,
    },
    "box": {
        "fontsize": 72, "bold": -1,
        "primary": "&H00FFFFFF", "highlight": "&H0000FFFF",
        "outline": 0, "shadow": 0, "back_color": "&H99000000",
        "border_style": 3,
    },
    "mono": {
        "fontsize": 68, "bold": 0,
        "primary": "&H00E0E0E0", "highlight": "&H0000FF99",
        "outline": 1, "shadow": 0, "back_color": "&H00000000",
        "border_style": 1,
    },
    "glow": {
        "fontsize": 80, "bold": -1,
        "primary": "&H00FFFFFF", "highlight": "&H00FF66FF",
        "outline": 6, "shadow": 4, "back_color": "&H00000000",
        "border_style": 1,
    },
}

SIZE_SCALE = {"S": 0.75, "M": 1.0, "L": 1.3}

# Alignment: ASS alignment for bottom/mid/top center
POSITION_ALIGN = {"bot": 2, "mid": 5, "top": 8}
POSITION_MARGIN = {"bot": 120, "mid": 0, "top": 60}


def _build_ass_header(style: str, position: str, size: str, split_mode: bool = False) -> str:
    preset = PRESETS.get(style, PRESETS["bold"])
    scale = SIZE_SCALE.get(size, 1.0)
    fontsize = int(preset["fontsize"] * scale)
    align = POSITION_ALIGN.get(position, 2)
    margin_v = POSITION_MARGIN.get(position, 120)

    # Dalam split mode, panel atas hanya 60% tinggi frame.
    # MarginV digeser ke atas agar subtitle tetap berada di dalam panel atas.
    if split_mode:
        from processing.config import SPLIT_SCREEN_TOP_RATIO
        # PlayResY tetap 1920 (tinggi penuh), tapi kita push margin supaya subtitle
        # tidak turun ke area hitam di bawah panel. Tambah 40% * 1920 = 768px ke margin_v.
        bottom_area_px = int(1920 * (1.0 - SPLIT_SCREEN_TOP_RATIO))
        margin_v = margin_v + bottom_area_px

    return (
        "[Script Info]\n"
        "ScriptType: v4.00+\n"
        "PlayResX: 1080\n"
        "PlayResY: 1920\n"
        "ScaledBorderAndShadow: yes\n\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, "
        "Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, "
        "Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
        f"Style: Default,Arial,{fontsize},"
        f"{preset['primary']},&H000000FF,&H00000000,{preset['back_color']},"
        f"{preset['bold']},0,0,0,100,100,0,0,"
        f"{preset['border_style']},{preset['outline']},{preset['shadow']},"
        f"{align},60,60,{margin_v},1\n\n"
        "[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )


class WordTimestamp(BaseModel):
    word: str
    start: float
    end: float


class SubtitleRequest(BaseModel):
    words: List[WordTimestamp]
    style: str = "bold"
    position: str = "bot"
    size: str = "M"
    caption_text: Optional[str] = None
    clip_duration: float
    out_dir: str
    clip_id: str
    split_mode: bool = False


def _fmt_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def _generate_ass(words: List[WordTimestamp], style: str, position: str, size: str,
                  split_mode: bool = False) -> str:
    preset = PRESETS.get(style, PRESETS["bold"])
    lines = [_build_ass_header(style, position, size, split_mode=split_mode)]

    groups = [words[i:i + WORDS_PER_LINE] for i in range(0, len(words), WORDS_PER_LINE)]
    for group in groups:
        if not group:
            continue
        group_end = group[-1].end
        for wi, active_word in enumerate(group):
            text_parts = []
            for i, w in enumerate(group):
                if i == wi:
                    text_parts.append(
                        f"{{\\c{preset['highlight']}&}}{w.word}{{\\c{preset['primary']}&}}"
                    )
                else:
                    text_parts.append(w.word)
            dialogue_text = " ".join(text_parts)
            start = _fmt_time(active_word.start)
            end_t = active_word.end if wi < len(group) - 1 else group_end
            end = _fmt_time(end_t)
            lines.append(f"Dialogue: 0,{start},{end},Default,,0,0,0,,{dialogue_text}")

    return "\n".join(lines)


def _generate_ass_from_text(text: str, clip_duration: float, style: str, position: str, size: str,
                            split_mode: bool = False) -> str:
    lines = [_build_ass_header(style, position, size, split_mode=split_mode)]
    start = _fmt_time(0)
    end = _fmt_time(clip_duration)
    lines.append(f"Dialogue: 0,{start},{end},Default,,0,0,0,,{text}")
    return "\n".join(lines)


@router.post("/subtitle")
def generate_subtitle(req: SubtitleRequest):
    logger.info(
        f"Generating subtitle for clip {req.clip_id} "
        f"(style={req.style}, position={req.position}, size={req.size})"
    )

    Path(req.out_dir).mkdir(parents=True, exist_ok=True)
    ass_path = os.path.join(req.out_dir, f"{req.clip_id}.ass")

    if req.caption_text:
        ass_content = _generate_ass_from_text(
            req.caption_text, req.clip_duration, req.style, req.position, req.size,
            split_mode=req.split_mode,
        )
    elif req.words:
        ass_content = _generate_ass(req.words, req.style, req.position, req.size,
                                    split_mode=req.split_mode)
    else:
        raise HTTPException(status_code=400, detail="Provide words or caption_text")

    with open(ass_path, "w", encoding="utf-8") as f:
        f.write(ass_content)

    return {"ass_path": ass_path, "ass_content": ass_content}
