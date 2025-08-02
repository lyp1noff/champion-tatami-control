# Backend
format-back:
	cd backend && poetry run black . && poetry run isort .

lint-back:
	cd backend && poetry run flake8 . && poetry run mypy .

test-back:
	cd backend && poetry run pytest

dev-back:
	cd backend && poetry install && poetry run uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

# Frontend
format-front:
	cd frontend && npm run format

lint-front:
	cd frontend && npm run lint

build-front:
	cd frontend && npm run build

dev-front:
	cd frontend && npm install && npm run dev

# Other
db:
	docker compose --env-file .env up db

dev-docker:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env.docker up --build

# Combined
format: format-front format-back
lint: lint-front lint-back
test: test-back
commit: format lint
