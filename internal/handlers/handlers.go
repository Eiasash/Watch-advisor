package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/Eiasash/Watch-advisor/internal/config"
)

// Register sets up all HTTP routes on the given mux.
func Register(mux *http.ServeMux, cfg config.Config) {
	// API routes.
	mux.HandleFunc("GET /api/health", healthHandler)

	// Serve static files (index.html, icons, manifest, service worker).
	fs := http.FileServer(http.Dir(cfg.StaticDir))
	mux.Handle("/", fs)
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status": "ok",
	})
}
