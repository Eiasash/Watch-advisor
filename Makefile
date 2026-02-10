.PHONY: build run test clean

# Build the server binary.
build:
	go build -o bin/server ./cmd/server

# Run the server locally.
run: build
	./bin/server

# Run all tests.
test:
	go test ./...

# Run tests with verbose output.
test-v:
	go test -v ./...

# Remove build artifacts.
clean:
	rm -rf bin/
