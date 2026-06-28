package license

import "testing"

func TestIsValidSerialFormat(t *testing.T) {
	cases := []struct {
		serial string
		want   bool
	}{
		{"AC-ABCD-1234-EF56-7890", true},
		{"AC-0000-0000-0000-0000", true},
		{"AC-abcd-1234-ef56-7890", false}, // lower-case not allowed by the raw pattern
		{"XX-ABCD-1234-EF56-7890", false}, // wrong prefix
		{"AC-ABC-1234-EF56-7890", false},  // group too short
		{"AC-ABCD-1234-EF56", false},      // missing a group
		{"AC-ABCD-1234-EF56-7890-EXTRA", false},
		{"", false},
	}
	for _, c := range cases {
		if got := isValidSerialFormat(c.serial); got != c.want {
			t.Errorf("isValidSerialFormat(%q) = %v, want %v", c.serial, got, c.want)
		}
	}
}

func TestGenerateHashDeterministicAndSensitive(t *testing.T) {
	base := generateHash("SEED", "hwid", "salt")

	if got := generateHash("SEED", "hwid", "salt"); got != base {
		t.Error("generateHash not deterministic for identical inputs")
	}
	// SHA-256 hex is 64 chars.
	if len(base) != 64 {
		t.Errorf("hash length = %d, want 64", len(base))
	}
	// Each input component must affect the output.
	if generateHash("OTHER", "hwid", "salt") == base {
		t.Error("hash insensitive to serial change")
	}
	if generateHash("SEED", "other", "salt") == base {
		t.Error("hash insensitive to hwid change")
	}
	if generateHash("SEED", "hwid", "other") == base {
		t.Error("hash insensitive to salt change")
	}
}
