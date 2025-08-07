# Backend
back-format:
	cd backend && poetry run black . && poetry run isort .

back-lint:
	cd backend && poetry run flake8 . && poetry run mypy .

back-test:
	cd backend && poetry run pytest

back-dev:
	cd backend && poetry install && poetry run uvicorn src.main:app --reload --host 0.0.0.0 --port 8001

# Frontend
front-format:
	cd frontend && npm run format

front-lint:
	cd frontend && npm run lint

front-build:
	cd frontend && npm run build

front-dev:
	cd frontend && npm install && npm run dev

# Outbox
outbox-dev:
	cd outbox && go run cmd/outbox-worker/main.go

# Other
db:
	docker compose --env-file .env up db

docker-dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.docker up --build

# Combined
format: front-format back-format
lint: front-lint back-lint
test: back-test
commit: format lint
