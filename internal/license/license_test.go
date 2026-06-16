package license

import "testing"

func TestGenerateHash(t *testing.T) {
	hash := generateHash("AC-TEST-1234-5678-ABCD", "hwid-123", "salt-xyz")
	if len(hash) != 64 {
		t.Errorf("expected 64 char hash, got %d", len(hash))
	}
}

func TestValidateSerialFormat(t *testing.T) {
	tests := []struct {
		serial string
		valid  bool
	}{
		{"AC-K9F2-M4X1-P7B3-Q8R5", true},
		{"AC-XXXX-XXXX-XXXX-XXXX", true},
		{"INVALID", false},
		{"AC-SHORT-KEY", false},
		{"", false},
		{"ac-k9f2-m4x1-p7b3-q8r5", false}, // lowercase invalid
	}
	for _, tt := range tests {
		result := isValidSerialFormat(tt.serial)
		if result != tt.valid {
			t.Errorf("serial %q: expected %v, got %v", tt.serial, tt.valid, result)
		}
	}
}

func TestGenerateSerial(t *testing.T) {
	serial := GenerateSerial("hwid-abc", "my-salt-32chars-long-enough-here")
	if !isValidSerialFormat(serial) {
		t.Errorf("GenerateSerial produced invalid format: %s", serial)
	}
	if serial[:3] != "AC-" {
		t.Errorf("serial should start with AC-: %s", serial)
	}
}

func TestGenerateSerialDeterministic(t *testing.T) {
	s1 := GenerateSerial("same-hwid", "same-salt")
	s2 := GenerateSerial("same-hwid", "same-salt")
	if s1 != s2 {
		t.Errorf("GenerateSerial should be deterministic: %s != %s", s1, s2)
	}
}

func TestGenerateSerialUnique(t *testing.T) {
	s1 := GenerateSerial("hwid-aaa", "salt")
	s2 := GenerateSerial("hwid-bbb", "salt")
	if s1 == s2 {
		t.Errorf("different HWIDs should produce different serials")
	}
}
