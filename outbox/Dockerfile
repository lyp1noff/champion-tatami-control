FROM golang:1.24-bookworm AS build
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-s -w" -o /out/app ./cmd/outbox-worker/main.go

FROM gcr.io/distroless/static:nonroot
WORKDIR /app
COPY --from=build /out/app /app/app
USER nonroot:nonroot
ENTRYPOINT ["/app/app"]
