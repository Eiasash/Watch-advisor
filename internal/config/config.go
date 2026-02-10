package config

import "os"

// Config holds the application configuration.
type Config struct {
	Port      string
	StaticDir string
}

// Load reads configuration from environment variables with sensible defaults.
func Load() Config {
	return Config{
		Port:      getEnv("PORT", "8080"),
		StaticDir: getEnv("STATIC_DIR", "./static"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
