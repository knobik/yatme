.PHONY: up down up-prod down-prod

up:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

down:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml down

up-prod:
	docker compose up -d --build

down-prod:
	docker compose down
