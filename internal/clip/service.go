package clip

import (
	"github.com/google/uuid"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) GetByProject(projectID string) ([]Clip, error) {
	return s.repo.GetByProject(projectID)
}

func (s *Service) GetByID(id string) (*Clip, error) {
	return s.repo.GetByID(id)
}

func (s *Service) GetGallery() ([]GalleryItem, error) {
	return s.repo.GetGallery()
}

func (s *Service) AddCustom(projectID string, start, end int) (*Clip, error) {
	clips, err := s.repo.GetByProject(projectID)
	if err != nil {
		return nil, err
	}

	c := &Clip{
		ID:              uuid.New().String(),
		ProjectID:       projectID,
		ClipIndex:       len(clips),
		StartSeconds:    start,
		EndSeconds:      end,
		DurationSeconds: end - start,
		Enabled:         true,
		Status:          "pending",
		AspectRatio:     "9:16",
		CaptionStyle:    "bold",
		CaptionPosition: "bot",
		CaptionSize:     "M",
		TrackTemplate:   "single",
		TrackSmooth:     true,
		TrackSensitivity: 55,
	}
	if err := s.repo.Create(c); err != nil {
		return nil, err
	}
	return c, nil
}

func (s *Service) UpdateTimestamp(id string, start, end int) error {
	return s.repo.UpdateTimestamp(id, start, end)
}

func (s *Service) SetEnabled(id string, enabled bool) error {
	return s.repo.SetEnabled(id, enabled)
}

func (s *Service) Delete(id string) error {
	return s.repo.Delete(id)
}

func (s *Service) SetAspectRatio(id, ratio string) error {
	return s.repo.SetAspectRatio(id, ratio)
}

func (s *Service) SetCaptionStyle(id, styleID string) error {
	return s.repo.SetCaptionStyle(id, styleID)
}

func (s *Service) SetCaptionText(id, text string) error {
	return s.repo.SetCaptionText(id, text)
}

func (s *Service) SetTrackTemplate(id, templateID string) error {
	return s.repo.SetTrackTemplate(id, templateID)
}

func (s *Service) SetTrackOpts(id string, smooth, lockMain bool, sensitivity int, reserveBottom bool) error {
	if err := s.repo.SetTrackSmooth(id, smooth); err != nil {
		return err
	}
	if err := s.repo.SetTrackLockMain(id, lockMain); err != nil {
		return err
	}
	if err := s.repo.SetTrackSensitivity(id, sensitivity); err != nil {
		return err
	}
	return s.repo.SetTrackReserveBottom(id, reserveBottom)
}

func (s *Service) SetCaptionOpts(id, position, size string) error {
	if err := s.repo.SetCaptionPosition(id, position); err != nil {
		return err
	}
	return s.repo.SetCaptionSize(id, size)
}
