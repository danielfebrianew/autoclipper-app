package tests

import (
	"strings"
	"testing"

	"auto-clipper/internal/license"
)

// GenerateSerial is deterministic for a given (hwid, salt) and must match the
// AC-XXXX-XXXX-XXXX-XXXX format that Validate accepts.
func TestGenerateSerialFormat(t *testing.T) {
	cases := []struct {
		name string
		hwid string
		salt string
	}{
		{name: "typical", hwid: "abc123def456", salt: "s3cr3t"},
		{name: "empty hwid", hwid: "", salt: "salt"},
		{name: "empty salt", hwid: "hwid", salt: ""},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			serial := license.GenerateSerial(tc.hwid, tc.salt)

			if !strings.HasPrefix(serial, "AC-") {
				t.Errorf("serial %q missing AC- prefix", serial)
			}
			// AC- + 4 groups of 4 + 3 dashes = 3 + 4*4 + 3 = 22 chars
			if len(serial) != 22 {
				t.Errorf("serial %q len = %d, want 22", serial, len(serial))
			}
			if got := strings.Count(serial, "-"); got != 4 {
				t.Errorf("serial %q has %d dashes, want 4", serial, got)
			}
			if serial != strings.ToUpper(serial) {
				t.Errorf("serial %q should be upper-case", serial)
			}
		})
	}
}

func TestGenerateSerialDeterministic(t *testing.T) {
	a := license.GenerateSerial("same-hwid", "same-salt")
	b := license.GenerateSerial("same-hwid", "same-salt")
	if a != b {
		t.Errorf("same inputs gave different serials: %q vs %q", a, b)
	}

	c := license.GenerateSerial("other-hwid", "same-salt")
	if a == c {
		t.Errorf("different hwid gave same serial %q", a)
	}
}

// Validate rejects anything that doesn't match the serial format before it ever
// touches the hardware ID, so these cases are deterministic across machines.
func TestValidateRejectsBadFormat(t *testing.T) {
	bad := []string{
		"",
		"not-a-serial",
		"AC-XXXX-XXXX-XXXX",      // only 3 groups
		"XX-AAAA-BBBB-CCCC-DDDD", // wrong prefix
		"AC-AAA-BBBB-CCCC-DDDD",  // group too short
		"AC-AAA!-BBBB-CCCC-DDDD", // illegal character
	}

	for _, serial := range bad {
		t.Run(serial, func(t *testing.T) {
			st, err := license.Validate(serial, "salt")
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if st.Valid {
				t.Errorf("expected invalid for %q, got Valid=true", serial)
			}
		})
	}
}
