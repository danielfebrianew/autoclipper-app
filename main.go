package main

import (
	"context"
	"embed"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"auto-clipper/internal/asset"
	"auto-clipper/internal/clip"
	"auto-clipper/internal/config"
	"auto-clipper/internal/database"
	applogger "auto-clipper/internal/logger"
	"auto-clipper/internal/project"
	"auto-clipper/internal/settings"

	"github.com/rs/zerolog/log"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

// mediaHandler serves local files under /media/<abs-path> so the WebView can
// load them via a normal HTTP URL without needing file:// access.
type mediaHandler struct{}

func (mediaHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Route /preview/frame ke decoder native (libav via CGo).
	if strings.HasPrefix(r.URL.Path, "/preview/frame") {
		previewFrameHandler().ServeHTTP(w, r)
		return
	}

	// Strip /media prefix, remainder is the absolute path on disk.
	diskPath := strings.TrimPrefix(r.URL.Path, "/media")
	if diskPath == "" || strings.Contains(diskPath, "..") {
		http.NotFound(w, r)
		return
	}
	ext := strings.ToLower(filepath.Ext(diskPath))
	ct := mime.TypeByExtension(ext)
	if ct == "" {
		ct = "application/octet-stream"
	}
	w.Header().Set("Content-Type", ct)
	w.Header().Set("Accept-Ranges", "bytes")
	http.ServeFile(w, r, diskPath)
}

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Load config
	cfg, err := config.Load("config.yaml")
	if err != nil {
		cfg, err = config.Load("config.example.yaml")
		if err != nil {
			panic("config.yaml not found — copy config.example.yaml and fill in values")
		}
	}

	// Logger
	if err := applogger.Init(cfg.Paths.LogFile, os.Getenv("DEBUG") == "1"); err != nil {
		panic("failed to init logger: " + err.Error())
	}

	// Data dir
	if err := os.MkdirAll(cfg.Paths.DataDir, 0755); err != nil {
		log.Fatal().Err(err).Msg("failed to create data dir")
	}

	// Database
	dbPath := filepath.Join(cfg.Paths.DataDir, "autoclipper.db")
	migrationsPath, _ := filepath.Abs("migrations")
	db, err := database.New(dbPath, migrationsPath)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to initialize database")
	}

	// Repositories & services
	projectRepo := project.NewRepository(db)
	projectSvc := project.NewService(projectRepo)
	clipRepo := clip.NewRepository(db)
	clipSvc := clip.NewService(clipRepo)
	assetRepo := asset.NewRepository(db)
	settingsSvc := settings.NewService(db, cfg.Encryption.Key)

	// App
	app := NewApp(cfg)
	app.wire(projectSvc, projectRepo, clipSvc, clipRepo, assetRepo, settingsSvc)

	err = wails.Run(&options.App{
		Title:  "Auto Clipper",
		Width:  1280,
		Height: 800,
		AssetServer: &assetserver.Options{
			Assets:  assets,
			Handler: mediaHandler{},
		},
		BackgroundColour: &options.RGBA{R: 15, G: 15, B: 20, A: 1},
		OnStartup: func(ctx context.Context) {
			app.startup(ctx)
			app.initPipelines()
		},
		OnShutdown: func(ctx context.Context) {
			previewShutdown() // lepas semua decoder native libav
		},
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		log.Fatal().Err(err).Msg("Wails run failed")
	}
}
