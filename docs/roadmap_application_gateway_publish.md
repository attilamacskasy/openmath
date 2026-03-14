# Home Lab Application Gateway — Traefik Spec

**Status:** Planned  
**Date:** 2026-03-14  
**Sites:** `openmath.hu`, `cloudmigration.blog`

---

## 1. Goal

Run **Traefik** as a single Docker container on the home lab, terminating HTTPS for
all public domains, auto-managing Let's Encrypt certificates, and routing to
internal services over plain HTTP.

---

## 2. Why Traefik

| Criterion | Traefik | NGINX Proxy Manager | Envoy |
|---|---|---|---|
| Auto Let's Encrypt | built-in ACME | built-in | manual / cert-manager |
| Docker label routing | native | no (GUI) | no |
| Config complexity | low (file + labels) | low (GUI) | high (xDS) |
| Resource footprint | ~30 MB | ~60 MB | ~100 MB |
| Dashboard | included | included | no |
| Home-lab fit | **best** | good | overkill |

### Alternatives — why not

- **Synology Web Station** — limited to basic hosting, no dynamic routing.
- **NGINX + web UI (NPM)** — viable but no native Docker label discovery.
- **Envoy** — enterprise-grade, too complex for 2-site home lab.

---

## 3. Current Production Architecture (as-is)

```
┌─────────────────────────────────────────────────────────────┐
│  Docker Host                                                │
│                                                             │
│  docker-compose.prod.yml (openmath)                         │
│  ┌─────────────────────────────────┐                        │
│  │ angular-app (nginx)  :80  ◄────────── public port 80     │
│  │   /api/* → python-api:8000     │                         │
│  ├─────────────────────────────────┤                        │
│  │ python-api (uvicorn) :8000     │  internal only          │
│  ├─────────────────────────────────┤                        │
│  │ postgresql            :5432    │  internal only          │
│  └─────────────────────────────────┘                        │
│                                                             │
│  Ubuntu VM (blog)                                           │
│  ┌───────────────────────┐                                  │
│  │ cloudmigration.blog   │  :443 self-managed HTTPS         │
│  └───────────────────────┘                                  │
└─────────────────────────────────────────────────────────────┘
```

**Problem:** No TLS on OpenMath, no unified entry point, port 80 is directly
exposed from the Angular container.

---

## 4. Target Architecture (to-be)

```
Internet
   │
   ▼
┌──────────────────────────────────────────────────────────────┐
│  Router / Firewall                                           │
│  Port-forward 80 & 443 → Docker Host                         │
└────────────────────────────┬─────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────┐
│  Docker Host                                                 │
│                                                              │
│  ┌── traefik container ──────────────────────────────────┐   │
│  │  :443 (HTTPS)  ◄── public                             │   │
│  │  :80  (HTTP)   ◄── redirect → 443                     │   │
│  │  :8080 (dashboard) ◄── LAN only (optional)            │   │
│  │                                                        │   │
│  │  Let's Encrypt ACME (TLS-ALPN-01 or HTTP-01)          │   │
│  │  Certificate storage: ./letsencrypt/acme.json          │   │
│  └───────┬──────────────────────────────┬────────────────┘   │
│          │                              │                     │
│          ▼                              ▼                     │
│  ┌───────────────────┐    ┌────────────────────────┐         │
│  │ openmath stack     │    │ blog (Ubuntu VM)       │         │
│  │ angular-app :80    │    │ 192.168.x.y:443        │         │
│  │  (nginx → api)     │    └────────────────────────┘         │
│  │ python-api :8000   │                                       │
│  │ postgresql :5432   │                                       │
│  └───────────────────┘                                       │
│                                                              │
│  Networks:                                                   │
│    traefik-public  (traefik + angular-app)                   │
│    openmath-local-prod-net  (angular-app + api + db)         │
└──────────────────────────────────────────────────────────────┘
```

### Key points

- **Only the Angular frontend** is exposed to Traefik. The API and DB stay
  internal — nginx inside `angular-app` already proxies `/api/*` to `python-api`.
- Traefik handles TLS termination → forwards plain HTTP to `angular-app:80`.
- Blog traffic is forwarded with the host header preserved; the Ubuntu VM
  keeps its own HTTPS cert (Traefik does TLS pass-through or terminates and
  re-encrypts — see Section 7).

---

## 5. Domain & Certificate Strategy

| Domain | Backend | TLS |
|---|---|---|
| `openmath.hu` | `angular-app:80` (HTTP) | Let's Encrypt via Traefik |
| `cloudmigration.blog` | `192.168.x.y:443` (HTTPS) | Let's Encrypt via Traefik **or** pass-through |

- **ACME challenge:** HTTP-01 (simplest; Traefik listens on :80).
- **Certificate storage:** `./letsencrypt/acme.json` volume-mounted.
- **Auto-renewal:** Traefik renews 30 days before expiry, zero downtime.
- **DNS:** A records for both domains point to the home lab's public IP.

---

## 6. Traefik Setup — Docker Compose

### 6.1 File structure

```
/opt/traefik/                       # or any directory on the Docker host
├── docker-compose.yml              # Traefik container
├── traefik.yml                     # static config
├── config/
│   └── dynamic.yml                 # file-based routes (blog)
└── letsencrypt/
    └── acme.json                   # auto-created, chmod 600
```

### 6.2 `docker-compose.yml` (Traefik)

```yaml
# /opt/traefik/docker-compose.yml
services:
  traefik:
    image: traefik:v3
    container_name: traefik
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      # Dashboard — restrict to LAN in production
      # - "8080:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik.yml:/etc/traefik/traefik.yml:ro
      - ./config:/etc/traefik/config:ro
      - ./letsencrypt:/letsencrypt
    networks:
      - traefik-public

networks:
  traefik-public:
    external: true         # created once: docker network create traefik-public
```

### 6.3 `traefik.yml` (static configuration)

```yaml
# /opt/traefik/traefik.yml

# ── API / Dashboard ────────────────────────────────────────
api:
  dashboard: true
  insecure: false            # set true only for local debugging

# ── Entry Points ───────────────────────────────────────────
entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
  websecure:
    address: ":443"

# ── Providers ──────────────────────────────────────────────
providers:
  docker:
    endpoint: "unix:///var/run/docker.sock"
    exposedByDefault: false    # only containers with traefik.enable=true
    network: traefik-public
  file:
    directory: /etc/traefik/config
    watch: true

# ── Let's Encrypt (ACME) ──────────────────────────────────
certificatesResolvers:
  letsencrypt:
    acme:
      email: your-email@example.com        # ← change this
      storage: /letsencrypt/acme.json
      httpChallenge:
        entryPoint: web
```

### 6.4 `config/dynamic.yml` (blog route — file provider)

The blog runs on an external VM (not Docker), so we define it via file:

```yaml
# /opt/traefik/config/dynamic.yml

http:
  routers:
    blog:
      rule: "Host(`cloudmigration.blog`)"
      entryPoints:
        - websecure
      tls:
        certResolver: letsencrypt
      service: blog-svc

  services:
    blog-svc:
      loadBalancer:
        servers:
          - url: "https://192.168.x.y"     # ← Ubuntu VM IP
        passHostHeader: true
```

### 6.5 OpenMath `docker-compose.prod.yml` changes

The Angular container needs Docker labels for Traefik discovery and must join the
`traefik-public` network. **Remove** the host port mapping (`ports: 80:80`).

```yaml
  angular-app:
    build:
      context: ./angular-app
      dockerfile: Dockerfile
    image: openmath/angular-app:latest
    container_name: openmath-local-prod-frontend
    restart: unless-stopped
    depends_on:
      python-api:
        condition: service_healthy
    # ports:                              # ← REMOVED — Traefik handles ingress
    #   - "${PUBLIC_PORT:-80}:80"
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.openmath.rule=Host(`openmath.hu`)"
      - "traefik.http.routers.openmath.entrypoints=websecure"
      - "traefik.http.routers.openmath.tls.certresolver=letsencrypt"
      - "traefik.http.services.openmath.loadbalancer.server.port=80"
    networks:
      - openmath-local-prod-net
      - traefik-public                    # ← ADD this network

networks:
  openmath-local-prod-net:
    driver: bridge
  traefik-public:
    external: true                        # ← ADD — shared with Traefik
```

---

## 7. Blog Routing — Two Options

| Option | How it works | Pros | Cons |
|---|---|---|---|
| **A — TLS termination at Traefik** | Traefik gets LE cert for `cloudmigration.blog`, forwards HTTP/HTTPS to VM | Single cert manager | Cert on VM becomes unused |
| **B — TLS pass-through** | Traefik passes raw TLS to VM, VM uses its own cert | Zero change on VM | Two cert managers |

**Recommended: Option A** — Traefik terminates TLS for both sites, forwards to the
blog VM over HTTPS (or HTTP if the VM drops its own cert). The `dynamic.yml`
shown in Section 6.4 implements Option A.

For Option B (pass-through), replace the blog router config:

```yaml
tcp:
  routers:
    blog-passthrough:
      rule: "HostSNI(`cloudmigration.blog`)"
      entryPoints:
        - websecure
      tls:
        passthrough: true
      service: blog-tcp

  services:
    blog-tcp:
      loadBalancer:
        servers:
          - address: "192.168.x.y:443"
```

---

## 8. Step-by-Step Deployment

### 8.1 Prerequisites

```bash
# Docker & Docker Compose v2 installed on the host
docker --version       # 24+
docker compose version # v2.20+
```

### 8.2 DNS

Create **A records** pointing to your home lab's public IP:

| Record | Type | Value |
|---|---|---|
| `openmath.hu` | A | `<public-IP>` |
| `www.openmath.hu` | CNAME | `openmath.hu` |
| `cloudmigration.blog` | A | `<public-IP>` |

### 8.3 Router / Firewall

Port-forward on your router:

| External Port | Internal Target | Protocol |
|---|---|---|
| 80 | Docker host :80 | TCP |
| 443 | Docker host :443 | TCP |

### 8.4 Create shared network

```bash
docker network create traefik-public
```

### 8.5 Deploy Traefik

```bash
mkdir -p /opt/traefik/config /opt/traefik/letsencrypt
touch /opt/traefik/letsencrypt/acme.json
chmod 600 /opt/traefik/letsencrypt/acme.json

# Create the files from Section 6.2 – 6.4, then:
cd /opt/traefik
docker compose up -d
```

### 8.6 Update & redeploy OpenMath

```bash
cd /path/to/openmath

# Edit docker-compose.prod.yml (add labels, remove ports, add network)
# Then:
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

### 8.7 Verify

```bash
# Check Traefik logs for LE certificate acquisition
docker logs traefik --tail 50

# Test HTTPS
curl -I https://openmath.hu
curl -I https://cloudmigration.blog
```

---

## 9. Scripted Configuration

Traefik has **no Terraform provider** for its routing config. Configuration is
done through two mechanisms:

| Mechanism | Best for | How |
|---|---|---|
| **Docker labels** | Container-based services (OpenMath) | Labels in `docker-compose.prod.yml` |
| **File provider** | VM / external services (blog) | YAML files in `config/` — Traefik watches for changes |

Both are already shown in Section 6. Below are scripted approaches to manage
the file-provider routes programmatically.

### 9.1 CLI — add/remove sites with a bash script

```bash
#!/usr/bin/env bash
# /opt/traefik/manage-site.sh
# Usage:
#   ./manage-site.sh add  <name> <domain> <backend-url>
#   ./manage-site.sh remove <name>
#   ./manage-site.sh list
#
# Examples:
#   ./manage-site.sh add blog cloudmigration.blog https://192.168.1.50
#   ./manage-site.sh add wiki wiki.macskasy.com http://192.168.1.60:3000
#   ./manage-site.sh remove wiki

set -euo pipefail
CONFIG_DIR="/opt/traefik/config"

add_site() {
  local name="$1" domain="$2" url="$3"
  cat > "${CONFIG_DIR}/${name}.yml" <<EOF
# Auto-generated — managed by manage-site.sh
http:
  routers:
    ${name}:
      rule: "Host(\`${domain}\`)"
      entryPoints:
        - websecure
      tls:
        certResolver: letsencrypt
      service: ${name}-svc

  services:
    ${name}-svc:
      loadBalancer:
        servers:
          - url: "${url}"
        passHostHeader: true
EOF
  echo "✓ Added site '${name}' → ${domain} → ${url}"
  echo "  Traefik will pick it up automatically (file watcher)."
}

remove_site() {
  local name="$1"
  rm -f "${CONFIG_DIR}/${name}.yml"
  echo "✓ Removed site '${name}'"
}

list_sites() {
  echo "Configured file-provider sites:"
  for f in "${CONFIG_DIR}"/*.yml; do
    [ -f "$f" ] || continue
    name=$(basename "$f" .yml)
    domain=$(grep -oP "Host\(\x60\K[^\x60]+" "$f" 2>/dev/null || echo "?")
    url=$(grep -oP 'url:\s*"\K[^"]+' "$f" 2>/dev/null || echo "?")
    printf "  %-15s  %-30s  → %s\n" "$name" "$domain" "$url"
  done
}

case "${1:-}" in
  add)    add_site "$2" "$3" "$4" ;;
  remove) remove_site "$2" ;;
  list)   list_sites ;;
  *)      echo "Usage: $0 {add|remove|list} [args...]"; exit 1 ;;
esac
```

Usage:

```bash
chmod +x /opt/traefik/manage-site.sh

# Initial setup — add both sites
./manage-site.sh add blog cloudmigration.blog https://192.168.1.50
./manage-site.sh add openmath-ext openmath.hu http://openmath-local-prod-frontend:80
# (openmath-ext only needed if NOT using Docker labels)

# Later — add a third site
./manage-site.sh add wiki wiki.macskasy.com http://192.168.1.60:3000

# List all
./manage-site.sh list

# Remove
./manage-site.sh remove wiki
```

> Traefik's file provider has `watch: true` — no restart needed. New/changed
> YAML files are picked up within seconds.

### 9.2 Python alternative (integrable with dev.py)

```python
#!/usr/bin/env python3
"""Manage Traefik file-provider routes."""
import argparse, yaml, sys
from pathlib import Path

CONFIG_DIR = Path("/opt/traefik/config")

def add_site(name: str, domain: str, url: str):
    config = {
        "http": {
            "routers": {
                name: {
                    "rule": f"Host(`{domain}`)",
                    "entryPoints": ["websecure"],
                    "tls": {"certResolver": "letsencrypt"},
                    "service": f"{name}-svc",
                }
            },
            "services": {
                f"{name}-svc": {
                    "loadBalancer": {
                        "servers": [{"url": url}],
                        "passHostHeader": True,
                    }
                }
            },
        }
    }
    out = CONFIG_DIR / f"{name}.yml"
    out.write_text(yaml.dump(config, default_flow_style=False, sort_keys=False))
    print(f"✓ {out}  ({domain} → {url})")

def remove_site(name: str):
    (CONFIG_DIR / f"{name}.yml").unlink(missing_ok=True)
    print(f"✓ Removed {name}")

def list_sites():
    for f in sorted(CONFIG_DIR.glob("*.yml")):
        data = yaml.safe_load(f.read_text()) or {}
        routers = data.get("http", {}).get("routers", {})
        for rname, rconf in routers.items():
            print(f"  {rname:15s}  {rconf.get('rule', '?'):35s}")

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd")
    a = sub.add_parser("add");    a.add_argument("name"); a.add_argument("domain"); a.add_argument("url")
    r = sub.add_parser("remove"); r.add_argument("name")
    sub.add_parser("list")
    args = p.parse_args()
    if args.cmd == "add":     add_site(args.name, args.domain, args.url)
    elif args.cmd == "remove": remove_site(args.name)
    elif args.cmd == "list":   list_sites()
    else: p.print_help()
```

### 9.3 Which approach for which service

| Service | Config method | Why |
|---|---|---|
| **OpenMath** (Docker) | Docker labels in `docker-compose.prod.yml` | Native — Traefik discovers automatically |
| **Blog** (VM) | File provider via `manage-site.sh` or Python | Not in Docker, so labels don't apply |
| **Future Docker services** | Docker labels | Same pattern as OpenMath |
| **Future VM services** | File provider script | Same pattern as blog |

> **Why not Terraform?** Traefik has no official Terraform provider. Its config
> is YAML files + Docker labels — not API-driven state. A simple script that
> writes YAML files is the idiomatic approach and matches how the Traefik
> community manages multi-site setups.

---

## 10. Operational Notes

### CORS update

Update `.env.prod` to include the public domain:

```env
CORS_ORIGINS=https://openmath.hu
GOOGLE_REDIRECT_URI=https://openmath.hu/auth/google/callback
```

### Dashboard access

Enable temporarily for debugging:

```yaml
# In traefik.yml
api:
  dashboard: true
  insecure: true    # exposes :8080 — disable in production

# In docker-compose.yml, uncomment:
ports:
  - "8080:8080"
```

Access at `http://<docker-host>:8080`.

### Adding a third site later

1. If Docker-based: add `traefik.enable` labels + join `traefik-public` network.
2. If VM-based: add a new router/service block in `config/dynamic.yml`.
3. No Traefik restart needed — file provider watches for changes.

### Certificate troubleshooting

```bash
# View stored certificates
cat /opt/traefik/letsencrypt/acme.json | python3 -m json.tool | grep -A2 "main"

# Force renewal (delete and restart)
rm /opt/traefik/letsencrypt/acme.json
docker restart traefik

# Use staging LE first to avoid rate limits
# In traefik.yml, add under acme:
#   caServer: https://acme-staging-v02.api.letsencrypt.org/directory
```

---

## 11. Security Checklist

- [ ] `acme.json` is `chmod 600`
- [ ] Docker socket mount is `:ro`
- [ ] Dashboard port (8080) is **not** exposed to the internet
- [ ] `exposedByDefault: false` in Traefik config
- [ ] HTTP → HTTPS redirect is active
- [ ] Router firewall only forwards ports 80 and 443
- [ ] `.env.prod` `CORS_ORIGINS` matches the public domain exactly
- [ ] Google OAuth redirect URI updated to `https://openmath.hu/…`