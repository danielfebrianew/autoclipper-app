.PHONY: dev dev-bypass build-mac build-windows test test-go test-py worker keygen clean

WAILS  := $(shell go env GOPATH)/bin/wails
VENV   := autoclipper-service-venv
PYTHON := $(VENV)/bin/python3

# === Dev ===
# PYTHONDONTWRITEBYTECODE=1 mencegah worker menulis __pycache__/*.pyc; tanpa itu
# file .pyc temporer yang ditulis-lalu-rename bikin Wails file-watcher crash
# (FATAL lstat ...pyc.NNNN: no such file or directory).

dev:
	PYTHONDONTWRITEBYTECODE=1 $(WAILS) dev

# Dev mode dengan license check di-skip (DEV ONLY — tidak ikut ke build production)
dev-bypass:
	DEV_BYPASS_LICENSE=1 PYTHONDONTWRITEBYTECODE=1 $(WAILS) dev

worker:
	cd worker && PYTHONDONTWRITEBYTECODE=1 ../$(PYTHON) -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload

keygen:
	go run ./cmd/keygen $(ARGS)

# === Build ===

build-mac:
	$(WAILS) build -platform darwin/arm64 -o AutoClipper

build-windows:
	$(WAILS) build -platform windows/amd64 -o AutoClipper.exe

# === Test ===

test: test-go test-py

test-go:
	go test auto-clipper/internal/... -v -count=1

test-py:
	cd worker && ../$(PYTHON) -m pytest tests/ -v

# === Setup ===

venv:
	python3 -m venv $(VENV)
	$(PYTHON) -m pip install -r worker/requirements.txt

# === Clean ===

clean:
	rm -rf build/bin
	find . -name "*.db" -not -path "./.git/*" -delete
