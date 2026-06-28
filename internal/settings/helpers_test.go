package settings

import "testing"

func TestOrDefault(t *testing.T) {
	cases := []struct{ v, def, want string }{
		{"value", "fallback", "value"},
		{"", "fallback", "fallback"},
		{"", "", ""},
	}
	for _, c := range cases {
		if got := orDefault(c.v, c.def); got != c.want {
			t.Errorf("orDefault(%q,%q) = %q, want %q", c.v, c.def, got, c.want)
		}
	}
}

func TestIntOrDefault(t *testing.T) {
	cases := []struct {
		v    string
		def  int
		want int
	}{
		{"42", 0, 42},
		{"", 7, 7},   // empty -> default
		{"-5", 0, -5},
		{"abc", 9, 0}, // unparseable -> Sscanf leaves 0
	}
	for _, c := range cases {
		if got := intOrDefault(c.v, c.def); got != c.want {
			t.Errorf("intOrDefault(%q,%d) = %d, want %d", c.v, c.def, got, c.want)
		}
	}
}

func TestBoolOrDefault(t *testing.T) {
	cases := []struct {
		v    string
		def  bool
		want bool
	}{
		{"1", false, true},
		{"true", false, true},
		{"0", true, false},
		{"false", true, false},
		{"", true, true},   // empty -> default
		{"", false, false}, // empty -> default
		{"yes", false, false}, // only "1"/"true" count as true
	}
	for _, c := range cases {
		if got := boolOrDefault(c.v, c.def); got != c.want {
			t.Errorf("boolOrDefault(%q,%v) = %v, want %v", c.v, c.def, got, c.want)
		}
	}
}

func TestFloatOrDefault(t *testing.T) {
	cases := []struct {
		v    string
		def  float64
		want float64
	}{
		{"3.14", 0, 3.14},
		{"", 1.5, 1.5}, // empty -> default
		{"0.0", 9, 0.0},
	}
	for _, c := range cases {
		if got := floatOrDefault(c.v, c.def); got != c.want {
			t.Errorf("floatOrDefault(%q,%v) = %v, want %v", c.v, c.def, got, c.want)
		}
	}
}

// itoa/btoa/ftoa are the serialization side; round-trip them against the parsers.
func TestStringifyRoundTrip(t *testing.T) {
	if got := itoa(123); got != "123" {
		t.Errorf("itoa(123) = %q", got)
	}
	if intOrDefault(itoa(-9), 0) != -9 {
		t.Error("itoa/intOrDefault round-trip failed")
	}

	if btoa(true) != "1" || btoa(false) != "0" {
		t.Errorf("btoa wrong: %q %q", btoa(true), btoa(false))
	}
	if !boolOrDefault(btoa(true), false) || boolOrDefault(btoa(false), true) {
		t.Error("btoa/boolOrDefault round-trip failed")
	}

	if got := ftoa(2.5); got != "2.5" {
		t.Errorf("ftoa(2.5) = %q", got)
	}
	if floatOrDefault(ftoa(0.125), 0) != 0.125 {
		t.Error("ftoa/floatOrDefault round-trip failed")
	}
}

func TestEncryptIfNonEmpty(t *testing.T) {
	t.Run("empty stays empty without encrypting", func(t *testing.T) {
		got, err := encryptIfNonEmpty(testKey32, "")
		if err != nil || got != "" {
			t.Errorf("got (%q,%v), want empty/nil", got, err)
		}
	})
	t.Run("non-empty is encrypted and decryptable", func(t *testing.T) {
		enc, err := encryptIfNonEmpty(testKey32, "api-key-123")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if enc == "api-key-123" {
			t.Error("value not encrypted")
		}
		dec, _ := decrypt(testKey32, enc)
		if dec != "api-key-123" {
			t.Errorf("decrypt = %q, want api-key-123", dec)
		}
	})
}
