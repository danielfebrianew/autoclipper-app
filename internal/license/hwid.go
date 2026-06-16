package license

import (
	"crypto/sha256"
	"fmt"
	"os/exec"
	"runtime"
	"strings"
)

func GetHWID() (string, error) {
	var raw string
	var err error

	switch runtime.GOOS {
	case "darwin":
		raw, err = macHWID()
	case "windows":
		raw, err = windowsHWID()
	default:
		return "", fmt.Errorf("unsupported platform: %s", runtime.GOOS)
	}

	if err != nil {
		return "", err
	}

	h := sha256.Sum256([]byte(strings.TrimSpace(raw)))
	return fmt.Sprintf("%x", h[:16]), nil
}

func macHWID() (string, error) {
	out, err := exec.Command("ioreg", "-rd1", "-c", "IOPlatformExpertDevice").Output()
	if err != nil {
		return "", err
	}
	for _, line := range strings.Split(string(out), "\n") {
		if strings.Contains(line, "IOPlatformUUID") {
			parts := strings.Split(line, "\"")
			if len(parts) >= 4 {
				return parts[len(parts)-2], nil
			}
		}
	}
	return "", fmt.Errorf("IOPlatformUUID not found")
}

func windowsHWID() (string, error) {
	out, err := exec.Command("wmic", "csproduct", "get", "UUID").Output()
	if err != nil {
		return "", err
	}
	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	if len(lines) < 2 {
		return "", fmt.Errorf("UUID not found")
	}
	return strings.TrimSpace(lines[1]), nil
}
