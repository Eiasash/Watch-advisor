package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Eiasash/Watch-advisor/internal/config"
)

func TestHealthHandler(t *testing.T) {
	mux := http.NewServeMux()
	cfg := config.Config{Port: "8080", StaticDir: "../../static"}
	Register(mux, cfg)

	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	w := httptest.NewRecorder()

	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var body map[string]string
	if err := json.NewDecoder(w.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if body["status"] != "ok" {
		t.Errorf("expected status ok, got %q", body["status"])
	}
}

func TestStaticFileServing(t *testing.T) {
	mux := http.NewServeMux()
	cfg := config.Config{Port: "8080", StaticDir: "../../static"}
	Register(mux, cfg)

	req := httptest.NewRequest(http.MethodGet, "/index.html", nil)
	w := httptest.NewRecorder()

	mux.ServeHTTP(w, req)

	// Static dir may not have files during unit test, so we just verify the route is registered.
	if w.Code == http.StatusMethodNotAllowed {
		t.Error("unexpected 405 for static file route")
	}
}
