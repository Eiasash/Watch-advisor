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

func TestHealthHandlerMethodNotAllowed(t *testing.T) {
	mux := http.NewServeMux()
	cfg := config.Config{Port: "8080", StaticDir: "../../static"}
	Register(mux, cfg)

	for _, method := range []string{http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodOptions} {
		req := httptest.NewRequest(method, "/api/health", nil)
		w := httptest.NewRecorder()

		mux.ServeHTTP(w, req)

		if w.Code != http.StatusMethodNotAllowed {
			t.Errorf("%s /api/health: expected 405, got %d", method, w.Code)
		}
		if allow := w.Header().Get("Allow"); allow != "GET, HEAD" {
			t.Errorf("%s /api/health: expected Allow header 'GET, HEAD', got %q", method, allow)
		}
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
