package project

import "testing"

func TestExtractVideoID(t *testing.T) {
	cases := []struct {
		name string
		url  string
		want string
	}{
		{name: "watch url", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", want: "dQw4w9WgXcQ"},
		{name: "watch url with extra params", url: "https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s", want: "dQw4w9WgXcQ"},
		{name: "short youtu.be", url: "https://youtu.be/dQw4w9WgXcQ", want: "dQw4w9WgXcQ"},
		{name: "short youtu.be with params", url: "https://youtu.be/dQw4w9WgXcQ?si=abc", want: "dQw4w9WgXcQ"},
		{name: "underscores and dashes in id", url: "https://www.youtube.com/watch?v=ab_cd-EF_12", want: "ab_cd-EF_12"},
		{name: "no id", url: "https://www.youtube.com/", want: ""},
		{name: "not a youtube url", url: "https://example.com/video", want: ""},
		{name: "empty string", url: "", want: ""},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := extractVideoID(tc.url); got != tc.want {
				t.Errorf("extractVideoID(%q) = %q, want %q", tc.url, got, tc.want)
			}
		})
	}
}
