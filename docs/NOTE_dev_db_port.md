# DEV-ONLY: Exposed PostgreSQL Port on Prod Stack

## What was changed

In `docker-compose.prod.yml`, the `postgresql` service has `ports: ["5433:5432"]` added so that **pgAdmin on the dev machine** can connect to the prod database at `localhost:5433`.

## pgAdmin Connection Settings

| Field | Value |
|-------|-------|
| Host | `localhost` |
| Port | `5433` |
| Database | `quiz` |
| Username | `quiz` |
| Password | *(see `.env.prod` → `POSTGRES_PASSWORD`)* |

## Why this exists

During local LAN testing (v4.0/v4.1 multiplayer), we need to inspect the database in real-time while players are connected. This port mapping makes the containerized prod DB accessible from pgAdmin on the host.

## Before deploying to real production

**Remove or comment out** the `ports` block from the `postgresql` service in `docker-compose.prod.yml`:

```yaml
    # ⚠️  DEV-ONLY: expose DB to host for pgAdmin. See docs/NOTE_dev_db_port.md
    # ports:
    #   - "5433:5432"
```

Exposing the database port in production is a security risk. The DB should only be accessible from the internal Docker network.

## Also check

- `.env.prod` → `CORS_ORIGINS` — remove LAN IPs before real prod deployment
