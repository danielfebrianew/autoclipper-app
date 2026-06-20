package project

import (
	"fmt"
	"path/filepath"
	"regexp"
	"strings"

	"auto-clipper/internal/video"

	"github.com/google/uuid"
)

var ytIDPattern = regexp.MustCompile(`(?:v=|youtu\.be/)([a-zA-Z0-9_-]{11})`)

type Service struct {
	repo     *Repository
	videoSvc *video.Repository
}

func NewService(repo *Repository, videoSvc *video.Repository) *Service {
	return &Service{repo: repo, videoSvc: videoSvc}
}

// CreateForVideo creates a new project (clip-set) for an already-downloaded
// video. Used both for first analysis and for "make more clips".
func (s *Service) CreateForVideo(videoID, name string) (*Project, error) {
	p := &Project{
		ID:            uuid.New().String(),
		SourceVideoID: videoID,
		Name:          name,
		Status:        "pending",
	}
	if err := s.repo.Create(p); err != nil {
		return nil, err
	}
	return p, nil
}

// Create downloads-and-analyzes a brand new YouTube URL: it creates the video
// row (if absent) and a first project for it. Returns the project, the video,
// and whether the video already existed (so callers can warn instead).
func (s *Service) Create(youtubeURL string) (*Project, *video.Video, bool, error) {
	videoID := extractVideoID(youtubeURL)
	if videoID == "" {
		return nil, nil, false, fmt.Errorf("invalid YouTube URL")
	}

	existing, err := s.videoSvc.FindByVideoID(videoID)
	if err == nil && existing != nil && existing.ID != "" {
		return nil, existing, true, nil
	}

	v := &video.Video{
		ID:         uuid.New().String(),
		YoutubeURL: youtubeURL,
		VideoID:    videoID,
		Status:     "pending",
	}
	if err := s.videoSvc.Create(v); err != nil {
		return nil, nil, false, err
	}
	p, err := s.CreateForVideo(v.ID, "")
	if err != nil {
		return nil, nil, false, err
	}
	return p, v, false, nil
}

// CreateFromFile creates a video + project from a local file (drag-drop).
func (s *Service) CreateFromFile(filePath string) (*Project, *video.Video, error) {
	name := strings.TrimSuffix(filepath.Base(filePath), filepath.Ext(filePath))
	v := &video.Video{
		ID:        uuid.New().String(),
		VideoID:   uuid.New().String(),
		Title:     name,
		VideoPath: filePath,
		Status:    "ready",
		IsLocal:   true,
	}
	if err := s.videoSvc.Create(v); err != nil {
		return nil, nil, err
	}
	p, err := s.CreateForVideo(v.ID, name)
	if err != nil {
		return nil, nil, err
	}
	return p, v, nil
}

func (s *Service) GetByID(id string) (*Project, error) {
	return s.repo.GetByID(id)
}

func (s *Service) List() ([]Project, error) {
	return s.repo.List()
}

func (s *Service) ListByVideo(videoID string) ([]Project, error) {
	return s.repo.ListByVideo(videoID)
}

func (s *Service) Delete(id string) error {
	return s.repo.Delete(id)
}

func extractVideoID(url string) string {
	m := ytIDPattern.FindStringSubmatch(url)
	if len(m) < 2 {
		return ""
	}
	return m[1]
}
