package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/Eiasash/Watch-advisor/internal/config"
)

// Register sets up all HTTP routes on the given mux.
func Register(mux *http.ServeMux, cfg config.Config) {
	// API routes.
	// Register the exact path for all methods so non-GET requests get a proper
	// 405 instead of falling through to the static file catch-all.
	mux.HandleFunc("/api/health", healthHandler)

	// Serve static files (index.html, icons, manifest, service worker).
	fs := http.FileServer(http.Dir(cfg.StaticDir))
	mux.Handle("/", fs)
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status": "ok",
	})
}
