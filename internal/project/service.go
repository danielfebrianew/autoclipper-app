package project

import (
	"fmt"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/google/uuid"
)

var ytIDPattern = regexp.MustCompile(`(?:v=|youtu\.be/)([a-zA-Z0-9_-]{11})`)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(youtubeURL string) (*Project, error) {
	videoID := extractVideoID(youtubeURL)
	if videoID == "" {
		return nil, fmt.Errorf("invalid YouTube URL")
	}

	p := &Project{
		ID:         uuid.New().String(),
		YoutubeURL: youtubeURL,
		VideoID:    videoID,
		Status:     "pending",
	}

	if err := s.repo.Create(p); err != nil {
		return nil, err
	}
	return p, nil
}

// CreateFromFile creates a project from a local video file (drag-drop).
func (s *Service) CreateFromFile(filePath string) (*Project, error) {
	name := strings.TrimSuffix(filepath.Base(filePath), filepath.Ext(filePath))
	p := &Project{
		ID:        uuid.New().String(),
		VideoID:   uuid.New().String(),
		Title:     name,
		VideoPath: filePath,
		Status:    "ready",
		IsLocal:   true,
	}
	if err := s.repo.Create(p); err != nil {
		return nil, err
	}
	return p, nil
}

func (s *Service) GetByID(id string) (*Project, error) {
	return s.repo.GetByID(id)
}

func (s *Service) List() ([]Project, error) {
	return s.repo.List()
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
