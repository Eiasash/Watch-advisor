package config

import (
	"os"
	"testing"
)

func TestLoadDefaults(t *testing.T) {
	// Unset env vars to test defaults.
	os.Unsetenv("PORT")
	os.Unsetenv("STATIC_DIR")

	cfg := Load()

	if cfg.Port != "8080" {
		t.Errorf("expected default port 8080, got %q", cfg.Port)
	}
	if cfg.StaticDir != "./static" {
		t.Errorf("expected default static dir ./static, got %q", cfg.StaticDir)
	}
}

func TestLoadFromEnv(t *testing.T) {
	os.Setenv("PORT", "3000")
	os.Setenv("STATIC_DIR", "/var/www")
	defer os.Unsetenv("PORT")
	defer os.Unsetenv("STATIC_DIR")

	cfg := Load()

	if cfg.Port != "3000" {
		t.Errorf("expected port 3000, got %q", cfg.Port)
	}
	if cfg.StaticDir != "/var/www" {
		t.Errorf("expected static dir /var/www, got %q", cfg.StaticDir)
	}
}
