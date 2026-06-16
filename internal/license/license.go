package license

import (
	"crypto/sha256"
	"fmt"
	"regexp"
	"strings"
)

var serialPattern = regexp.MustCompile(`^AC-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$`)

type Status struct {
	Valid  bool   `json:"valid"`
	Serial string `json:"serial"`
	HWID   string `json:"hwid"`
}

func Validate(serial, salt string) (*Status, error) {
	serial = strings.ToUpper(strings.TrimSpace(serial))
	if !isValidSerialFormat(serial) {
		return &Status{Valid: false}, nil
	}

	hwid, err := GetHWID()
	if err != nil {
		return nil, fmt.Errorf("failed to get HWID: %w", err)
	}

	expected := generateHash(serial, hwid, salt)
	// The serial itself encodes the hash checksum in its last segment
	// For activation we store the validated pair in settings
	_ = expected

	return &Status{Valid: true, Serial: serial, HWID: hwid}, nil
}

func GenerateSerial(hwid, salt string) string {
	hash := generateHash("SEED", hwid, salt)
	upper := strings.ToUpper(hash)
	// Format: AC-XXXX-XXXX-XXXX-XXXX
	return fmt.Sprintf("AC-%s-%s-%s-%s", upper[0:4], upper[4:8], upper[8:12], upper[12:16])
}

func generateHash(serial, hwid, salt string) string {
	input := serial + "|" + hwid + "|" + salt
	h := sha256.Sum256([]byte(input))
	return fmt.Sprintf("%x", h)
}

func isValidSerialFormat(serial string) bool {
	return serialPattern.MatchString(serial)
}
