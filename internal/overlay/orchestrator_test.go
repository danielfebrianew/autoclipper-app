package overlay

import "testing"

func TestBuildSegmentsNoTracks(t *testing.T) {
	segs := buildSegments(nil, 10)
	if len(segs) != 1 {
		t.Fatalf("expected 1 segment, got %d", len(segs))
	}
	if segs[0].start != 0 || segs[0].end != 10 || len(segs[0].tracks) != 0 {
		t.Fatalf("unexpected copy segment: %+v", segs[0])
	}
}

func TestBuildSegmentsSingleOverlay(t *testing.T) {
	tracks := []Track{{ID: "a", Kind: "image", StartSec: 2, EndSec: 5}}
	segs := buildSegments(tracks, 10)
	// Expect: [0,2) copy, [2,5) overlay, [5,10) copy
	if len(segs) != 3 {
		t.Fatalf("expected 3 segments, got %d: %+v", len(segs), segs)
	}
	if len(segs[0].tracks) != 0 || len(segs[1].tracks) != 1 || len(segs[2].tracks) != 0 {
		t.Fatalf("segment track layout wrong: %+v", segs)
	}
	if segs[1].start != 2 || segs[1].end != 5 {
		t.Fatalf("overlay span wrong: %+v", segs[1])
	}
}

func TestBuildSegmentsOverlapping(t *testing.T) {
	// Two tracks overlapping in [3,4): that span should carry both.
	tracks := []Track{
		{ID: "a", Kind: "image", StartSec: 1, EndSec: 4},
		{ID: "b", Kind: "image", StartSec: 3, EndSec: 6},
	}
	segs := buildSegments(tracks, 8)
	var both int
	for _, s := range segs {
		if len(s.tracks) == 2 {
			both++
			if s.start != 3 || s.end != 4 {
				t.Fatalf("overlap span wrong: %+v", s)
			}
		}
	}
	if both != 1 {
		t.Fatalf("expected exactly one 2-track span, got %d: %+v", both, segs)
	}
}

func TestNormalizeTracksClampAndDrop(t *testing.T) {
	p := &Project{VideoDuration: 10, Tracks: []Track{
		{ID: "ok", StartSec: 1, EndSec: 5},
		{ID: "clamp", StartSec: 8, EndSec: 99},  // end clamped to 10
		{ID: "past", StartSec: 12, EndSec: 15},  // dropped (starts past dur)
		{ID: "empty", StartSec: 4, EndSec: 4},   // dropped (zero length)
	}}
	out := normalizeTracks(p)
	if len(out) != 2 {
		t.Fatalf("expected 2 tracks, got %d: %+v", len(out), out)
	}
	for _, tr := range out {
		if tr.ID == "clamp" && tr.EndSec != 10 {
			t.Fatalf("clamp end not applied: %+v", tr)
		}
	}
}

func TestResolveOutputDimensions(t *testing.T) {
	// 1920x1080 forced to 9:16, keep height 1080 → width 608 (607→608 even).
	w, h := resolveOutputDimensions(1920, 1080, "9:16")
	if h != 1080 {
		t.Fatalf("expected height 1080, got %d", h)
	}
	if w%2 != 0 {
		t.Fatalf("width must be even, got %d", w)
	}
	if w != 608 {
		t.Fatalf("expected width 608, got %d", w)
	}
	// Invalid ratio → unchanged.
	w2, h2 := resolveOutputDimensions(1920, 1080, "bad")
	if w2 != 1920 || h2 != 1080 {
		t.Fatalf("invalid ratio should pass through, got %dx%d", w2, h2)
	}
}
