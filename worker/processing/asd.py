"""
Light-ASD wrapper — Active Speaker Detection (opt-in via AUTOCLIPPER_ASD=1).

Model: Light-ASD (CVPR 2023) by Junhua Liao et al.
Weights: downloaded on first use to weights/light_asd.model di data_dir.

Import hanya dilakukan saat dipanggil supaya torch tidak wajib di requirements.txt.
"""

import os
import logging
import urllib.request

import numpy as np
import cv2

log = logging.getLogger("worker.processing.asd")

_WEIGHTS_URL = (
    "https://github.com/Junhua-Liao/Light-ASD/raw/main/weight/pretrain_AVA_CVPR.model"
)

# Lokasi weights: DATA_DIR/weights/light_asd.model
# DATA_DIR diisi dari env AUTOCLIPPER_DATA_DIR (diset oleh Go sebelum spawn worker).
_DATA_DIR = os.environ.get("AUTOCLIPPER_DATA_DIR", os.path.expanduser("~/.autoclipper"))
_WEIGHTS_PATH = os.path.join(_DATA_DIR, "weights", "light_asd.model")


def _ensure_weights():
    os.makedirs(os.path.dirname(_WEIGHTS_PATH), exist_ok=True)
    if not os.path.exists(_WEIGHTS_PATH):
        log.info("Mengunduh Light-ASD weights (~20 MB)…")
        urllib.request.urlretrieve(_WEIGHTS_URL, _WEIGHTS_PATH)
        log.info("Download selesai: %s", _WEIGHTS_PATH)


# ---------------------------------------------------------------------------
# Model architecture (replicated from Light-ASD repo — minimal copy)
# ---------------------------------------------------------------------------

def _build_model():
    import torch
    import torch.nn as nn
    import torch.nn.functional as F

    class _BasicBlock(nn.Module):
        def __init__(self, in_c, out_c, stride=1):
            super().__init__()
            self.conv1 = nn.Conv2d(in_c, out_c, 3, stride=stride, padding=1, bias=False)
            self.bn1   = nn.BatchNorm2d(out_c)
            self.conv2 = nn.Conv2d(out_c, out_c, 3, padding=1, bias=False)
            self.bn2   = nn.BatchNorm2d(out_c)
            self.ds = None
            if stride != 1 or in_c != out_c:
                self.ds = nn.Sequential(
                    nn.Conv2d(in_c, out_c, 1, stride=stride, bias=False),
                    nn.BatchNorm2d(out_c),
                )

        def forward(self, x):
            identity = x
            out = F.relu(self.bn1(self.conv1(x)), inplace=True)
            out = self.bn2(self.conv2(out))
            if self.ds:
                identity = self.ds(x)
            return F.relu(out + identity, inplace=True)

    class _VisualEncoder(nn.Module):
        def __init__(self):
            super().__init__()
            self.frontend = nn.Sequential(
                nn.Conv3d(1, 64, (5, 7, 7), stride=(1, 2, 2), padding=(2, 3, 3), bias=False),
                nn.BatchNorm3d(64), nn.ReLU(inplace=True),
                nn.MaxPool3d((1, 3, 3), stride=(1, 2, 2), padding=(0, 1, 1)),
            )
            self.layer1 = nn.Sequential(_BasicBlock(64, 64), _BasicBlock(64, 64))
            self.layer2 = nn.Sequential(_BasicBlock(64, 128, stride=2), _BasicBlock(128, 128))
            self.layer3 = nn.Sequential(_BasicBlock(128, 256, stride=2), _BasicBlock(256, 256))
            self.layer4 = nn.Sequential(_BasicBlock(256, 512, stride=2), _BasicBlock(512, 512))
            self.avgpool = nn.AdaptiveAvgPool2d((1, 1))

        def forward(self, x):
            x = x.unsqueeze(1)                          # (B,1,T,112,112)
            x = self.frontend(x)
            B, C, T, H, W = x.shape
            x = x.permute(0, 2, 1, 3, 4).reshape(B * T, C, H, W)
            x = self.layer4(self.layer3(self.layer2(self.layer1(x))))
            x = self.avgpool(x).flatten(1)              # (B*T, 512)
            return x.reshape(B, T, 512)

    class _AudioEncoder(nn.Module):
        def __init__(self):
            super().__init__()
            self.fc1 = nn.Linear(13, 128)
            self.fc2 = nn.Linear(128, 512)

        def forward(self, x):
            B, A, D = x.shape
            T = A // 4
            x = x[:, :T * 4, :].reshape(B, T, 4, D).mean(dim=2)
            return self.fc2(F.relu(self.fc1(x), inplace=True))

    class _LightASD(nn.Module):
        def __init__(self):
            super().__init__()
            self.visual_encoder = _VisualEncoder()
            self.audio_encoder  = _AudioEncoder()
            self.classifier     = nn.Linear(1024, 2)

        def forward(self, visual, audio):
            v = self.visual_encoder(visual)
            a = self.audio_encoder(audio)
            return self.classifier(torch.cat([v, a], dim=-1))

    return _LightASD()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def load_asd_model():
    """
    Load Light-ASD model. Returns (model, device).
    Raises ImportError jika torch belum terinstall (opt-in).
    """
    import torch

    _ensure_weights()

    device = (
        torch.device("mps")  if torch.backends.mps.is_available() else
        torch.device("cuda") if torch.cuda.is_available() else
        torch.device("cpu")
    )
    log.info("ASD device: %s", device)

    model = _build_model()
    state = torch.load(_WEIGHTS_PATH, map_location="cpu")
    state = {k.replace("module.", ""): v for k, v in state.items()}
    own = model.state_dict()
    matched = {k: v for k, v in state.items() if k in own and own[k].shape == v.shape}
    own.update(matched)
    model.load_state_dict(own)
    model.to(device).eval()

    log.info("ASD model siap (%d/%d weights dimuat)", len(matched), len(own))
    if len(matched) < len(own) * 0.5:
        log.warning("< 50%% weights cocok — checkpoint mungkin berbeda arsitektur")
    return model, device


def compute_asd_scores(
    clip_path: str,
    audio_wav: str,
    face_tracks: list[dict],
    model,
    device,
    src_fps: float,
    window_sec: float = 0.5,
) -> dict[int, float]:
    """
    Hitung speaking score per frame.

    face_tracks: list of {"frame": int, "box": (x1,y1,x2,y2)}
    Returns: {frame_num: score} — score 0.0–1.0 (P(speaking))
    """
    import torch
    import scipy.io.wavfile as wavfile
    from python_speech_features import mfcc

    if not face_tracks:
        return {}

    sample_rate, audio_data = wavfile.read(audio_wav)
    if audio_data.ndim > 1:
        audio_data = audio_data[:, 0]
    audio_data = audio_data.astype(np.float32) / 32768.0

    cap = cv2.VideoCapture(clip_path)
    window_frames = max(1, int(src_fps * window_sec))

    by_frame: dict[int, list[dict]] = {}
    for t in face_tracks:
        by_frame.setdefault(t["frame"], []).append(t)

    frame_scores: dict[int, float] = {}

    for center_frame in sorted(by_frame.keys()):
        tracks = by_frame[center_frame]
        half    = window_frames // 2
        f_start = max(0, center_frame - half)
        f_end   = center_frame + half

        t_start = f_start / src_fps
        t_end   = f_end   / src_fps
        a_start = int(t_start * sample_rate)
        a_end   = int(t_end   * sample_rate)
        audio_chunk = audio_data[a_start:a_end]
        if len(audio_chunk) < sample_rate // 10:
            continue

        mfcc_feat = mfcc(audio_chunk, sample_rate, numcep=13, nfft=512)
        if mfcc_feat.shape[0] < 4:
            continue

        best_score = 0.0
        for track in tracks:
            x1, y1, x2, y2 = (int(v) for v in track["box"])

            crops = []
            cap.set(cv2.CAP_PROP_POS_FRAMES, f_start)
            for _ in range(f_end - f_start):
                ret, fr = cap.read()
                if not ret:
                    break
                face_crop = fr[max(0, y1):y2, max(0, x1):x2]
                if face_crop.size == 0:
                    face_crop = np.zeros((112, 112), dtype=np.uint8)
                else:
                    face_crop = cv2.resize(
                        cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY), (112, 112)
                    )
                crops.append(face_crop)

            if not crops:
                continue

            T = len(crops)
            visual = np.stack(crops).astype(np.float32) / 255.0
            A = T * 4
            mfcc_trimmed = (
                mfcc_feat[:A] if mfcc_feat.shape[0] >= A
                else np.pad(mfcc_feat, ((0, A - mfcc_feat.shape[0]), (0, 0)))
            )

            v_t = torch.from_numpy(visual).unsqueeze(0).to(device)
            a_t = torch.from_numpy(mfcc_trimmed.astype(np.float32)).unsqueeze(0).to(device)

            with torch.no_grad():
                logits = model(v_t, a_t)                      # (1, T, 2)
                score  = float(torch.softmax(logits, dim=-1)[0, :, 1].mean().cpu())

            best_score = max(best_score, score)

        frame_scores[center_frame] = best_score

    cap.release()
    return frame_scores


def is_asd_enabled() -> bool:
    return os.environ.get("AUTOCLIPPER_ASD", "0") == "1"
