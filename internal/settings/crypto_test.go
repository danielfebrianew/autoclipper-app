package settings

import (
	"strings"
	"testing"
)

const testKey32 = "0123456789abcdef0123456789abcdef" // exactly 32 bytes

func TestEncryptDecryptRoundTrip(t *testing.T) {
	cases := []string{
		"hello world",
		"",
		"AC-XXXX-YYYY-ZZZZ-WWWW",
		"unicode: αβγ 日本語 🎬",
		strings.Repeat("long-secret-", 100),
	}

	for _, plain := range cases {
		t.Run(plain[:min(len(plain), 16)], func(t *testing.T) {
			enc, err := encrypt(testKey32, plain)
			if err != nil {
				t.Fatalf("encrypt: %v", err)
			}
			if plain != "" && enc == plain {
				t.Error("ciphertext equals plaintext (not encrypted)")
			}
			dec, err := decrypt(testKey32, enc)
			if err != nil {
				t.Fatalf("decrypt: %v", err)
			}
			if dec != plain {
				t.Errorf("round-trip mismatch: got %q, want %q", dec, plain)
			}
		})
	}
}

func TestEncryptIsNondeterministic(t *testing.T) {
	// AES-GCM uses a random nonce, so two encryptions of the same text differ.
	a, _ := encrypt(testKey32, "same")
	b, _ := encrypt(testKey32, "same")
	if a == b {
		t.Error("expected different ciphertexts due to random nonce")
	}
}

func TestEncryptRejectsBadKeyLength(t *testing.T) {
	for _, key := range []string{"", "short", strings.Repeat("x", 31), strings.Repeat("x", 33)} {
		if _, err := encrypt(key, "data"); err == nil {
			t.Errorf("encrypt accepted invalid key length %d", len(key))
		}
	}
}

func TestDecryptErrors(t *testing.T) {
	t.Run("bad key length", func(t *testing.T) {
		if _, err := decrypt("short", "anything"); err == nil {
			t.Error("expected error for bad key length")
		}
	})
	t.Run("non-base64 input", func(t *testing.T) {
		if _, err := decrypt(testKey32, "!!!not base64!!!"); err == nil {
			t.Error("expected error for invalid base64")
		}
	})
	t.Run("ciphertext too short", func(t *testing.T) {
		// "YQ==" decodes to a single byte — shorter than a GCM nonce.
		if _, err := decrypt(testKey32, "YQ=="); err == nil {
			t.Error("expected error for too-short ciphertext")
		}
	})
	t.Run("wrong key fails auth", func(t *testing.T) {
		enc, _ := encrypt(testKey32, "secret")
		otherKey := "fedcba9876543210fedcba9876543210"
		if _, err := decrypt(otherKey, enc); err == nil {
			t.Error("expected auth failure when decrypting with a different key")
		}
	})
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
