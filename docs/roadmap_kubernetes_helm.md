# OpenMath — Kubernetes & Helm Deployment Roadmap

**Status:** Planned  
**Date:** 2026-03-14  
**Depends on:** Production Docker stack (live), Traefik gateway (planned), OTEL monitoring (planned), CI/CD pipeline via GitLab CE (planned), HashiCorp Vault (planned)

---

## 1. Overview

This roadmap defines the migration path from the current single-host Docker Compose
deployment to a **multi-node, self-hosted Kubernetes cluster** with **Helm-based
packaging and deployment**. The cluster runs on-premises on VMs managed by
**Proxmox VE**, aligning with the project's core principle of self-hosted,
open-source infrastructure.

This is the natural progression of the infrastructure after the Docker
production stack, CI/CD pipeline (see `roadmap_devops.md`), Traefik gateway
(see `roadmap_application_gateway_publish.md`), and secrets management
(see `roadmap_security.md`) are in place.

### Current state

| Area | Current state | Gap |
|---|---|---|
| **Container runtime** | Docker Engine on single Ubuntu VM | Single point of failure, no self-healing |
| **Orchestration** | Docker Compose (prod) | No rolling updates, no auto-scaling, manual restarts |
| **Networking** | Docker bridge network | No network policy, no service mesh, flat L2 |
| **Service discovery** | Docker DNS (container names) | No health-aware routing, no load balancing |
| **Ingress / TLS** | Traefik (planned, Docker-based) | Will migrate to Kubernetes Ingress Controller |
| **Secrets** | `.env` files → Vault (planned) | Will migrate to Kubernetes Secrets backed by Vault |
| **Deployment packaging** | `docker-compose.prod.yml` | No versioned releases, no rollback, no templating |
| **Scaling** | Manual `docker compose up --scale` | No HPA, no resource requests/limits |
| **Storage** | Docker volumes on local disk | No distributed storage, no PV/PVC |
| **Monitoring** | OTEL stack (planned, Docker-based) | Will run natively on K8s with Helm charts |
| **Virtualization** | Proxmox VE (home lab) | VMs available, K8s not provisioned yet |

### Why Kubernetes now

| Docker Compose limitation | Kubernetes solution |
|---|---|
| Single host = single point of failure | Multi-node cluster with pod rescheduling |
| Manual restart on crash | Self-healing via liveness/readiness probes |
| No rolling updates | Zero-downtime `RollingUpdate` strategy |
| No resource governance | CPU/memory requests, limits, LimitRanges, ResourceQuotas |
| No network segmentation | Calico NetworkPolicy for microsegmentation |
| No native secret rotation | Kubernetes Secrets + External Secrets Operator + Vault |
| No declarative desired state | `kubectl apply` / Helm release = desired state reconciliation |
| No horizontal scaling | HPA based on CPU, memory, or custom OTEL metrics |

---

## 2. Architecture — Current vs Target

### Current deployment (Docker Compose on single VM)

```
┌───────────────────────────────────────────────────────────────────┐
│  Proxmox VE Host                                                  │
│                                                                   │
│  ┌── Ubuntu VM (single) ───────────────────────────────────────┐  │
│  │  Docker Engine                                              │  │
│  │                                                             │  │
│  │  docker-compose.prod.yml                                    │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │  │
│  │  │ angular-app │  │ python-api   │  │ postgresql:16     │  │  │
│  │  │ (nginx :80) │  │ (uvicorn     │  │ (pgdata volume)  │  │  │
│  │  │             │  │  :8000)      │  │                   │  │  │
│  │  └─────────────┘  └──────────────┘  └───────────────────┘  │  │
│  │           ▲                                                 │  │
│  │           │ port 80                                         │  │
│  │  ┌────────┴──────┐                                          │  │
│  │  │ Traefik       │ (planned)                                │  │
│  │  │ TLS + routing │                                          │  │
│  │  └───────────────┘                                          │  │
│  └─────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

### Target deployment (Kubernetes on Proxmox VMs)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Proxmox VE Host(s)                                                        │
│                                                                            │
│  ┌── Control Plane VM ─────┐  ┌── Worker VM 1 ──────┐  ┌── Worker VM 2 ──┐│
│  │  k8s control plane      │  │  kubelet + CRI       │  │  kubelet + CRI  ││
│  │  etcd                   │  │  Calico node         │  │  Calico node    ││
│  │  kube-apiserver         │  │                      │  │                 ││
│  │  kube-scheduler         │  │  ┌── Pods ────────┐  │  │ ┌── Pods ─────┐││
│  │  kube-controller-mgr    │  │  │ angular-app    │  │  │ │ python-api  │││
│  │  Calico controller      │  │  │ python-api     │  │  │ │ angular-app │││
│  │                         │  │  │ otel-collector │  │  │ │ grafana     │││
│  │  (also runs workloads   │  │  └────────────────┘  │  │ └─────────────┘││
│  │   if resources allow)   │  │                      │  │                 ││
│  └─────────────────────────┘  └──────────────────────┘  └─────────────────┘│
│                                                                            │
│  ┌── Storage VM (optional) ┐  ┌── DB VM (dedicated) ─┐                     │
│  │  Longhorn / NFS         │  │  PostgreSQL 16        │                     │
│  │  PV provisioner         │  │  (bare-metal or       │                     │
│  │                         │  │   StatefulSet)        │                     │
│  └─────────────────────────┘  └───────────────────────┘                     │
│                                                                            │
│  Networking: Calico (BGP or VXLAN) — pod CIDR + service CIDR               │
│  Ingress:   Traefik Ingress Controller (Helm chart)                        │
│  Secrets:   Vault + External Secrets Operator                              │
│  Monitoring: Prometheus + Grafana + Loki (kube-prometheus-stack Helm)       │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Kubernetes Distribution Selection

### 3.1 Why kubeadm (vanilla Kubernetes)

| Distribution | Self-hosted | Multi-node | Production grade | Complexity | Home-lab fit |
|---|---|---|---|---|---|
| **kubeadm** | ✅ | ✅ | ✅ | Medium | **Best** |
| k3s (Rancher) | ✅ | ✅ | ✅ (lightweight) | Low | Good |
| RKE2 (Rancher) | ✅ | ✅ | ✅ | Medium | Good |
| MicroK8s (Canonical) | ✅ | ✅ | Partial | Low | Good |
| kind / minikube | ✅ | ❌ single-node | Dev only | Very low | Dev only |
| OpenShift (Red Hat) | ✅ | ✅ | Enterprise | High | Overkill |
| Tanzu / EKS-A | ✅ | ✅ | Enterprise | High | Overkill |

**Decision:** **kubeadm** provides vanilla upstream Kubernetes, full control over
cluster components, is the most widely documented, and maps directly to CKA/CKAD
certification knowledge. It runs on any Linux VM — perfect for Proxmox.

**Alternative considered:** k3s is a strong second choice for resource-constrained
labs. If the Proxmox host has limited RAM (< 16 GB total), k3s with its ~512 MB
footprint per node could be reconsidered.

### 3.2 Node topology

| Node | Role | VM specs (minimum) | OS |
|---|---|---|---|
| `k8s-cp1` | Control plane + etcd | 2 vCPU, 4 GB RAM, 50 GB disk | Ubuntu 22.04 LTS |
| `k8s-w1` | Worker | 2 vCPU, 4 GB RAM, 50 GB disk | Ubuntu 22.04 LTS |
| `k8s-w2` | Worker | 2 vCPU, 4 GB RAM, 50 GB disk | Ubuntu 22.04 LTS |
| `k8s-db1` | Dedicated DB (optional) | 2 vCPU, 4 GB RAM, 100 GB disk | Ubuntu 22.04 LTS |

**Total minimum:** 8 vCPU, 16 GB RAM (3-node cluster + DB). The control plane
can schedule workloads too in a small lab (remove the default taint).

---

## 4. Calico — Networking & Network Policy

### 4.1 Why Calico

| CNI Plugin | Networking | NetworkPolicy | Encryption | Complexity |
|---|---|---|---|---|
| **Calico** | BGP or VXLAN | ✅ Full L3/L4 | WireGuard | Medium |
| Flannel | VXLAN only | ❌ None | No | Low |
| Cilium | eBPF | ✅ L3/L4/L7 | WireGuard | High |
| Weave Net | VXLAN | ✅ Basic | IPsec | Low |

**Decision:** Calico provides both the **CNI networking layer** (pod-to-pod
communication) and the **NetworkPolicy enforcement** layer in a single
component. Its BGP mode avoids overlay overhead on bare-metal/VM clusters.
It is the most common CNI for on-premises production clusters.

### 4.2 Calico installation

```bash
# After kubeadm init with --pod-network-cidr=10.244.0.0/16
kubectl create -f https://raw.githubusercontent.com/projectcalico/calico/v3.27/manifests/tigera-operator.yaml

cat <<EOF | kubectl apply -f -
apiVersion: operator.tigera.io/v1
kind: Installation
metadata:
  name: default
spec:
  calicoNetwork:
    ipPools:
    - cidr: 10.244.0.0/16
      encapsulation: VXLANCrossSubnet   # VXLAN only across subnets
      natOutgoing: Enabled
      nodeSelector: all()
    linuxDataplane: Iptables            # or BPF for performance
EOF
```

### 4.3 NetworkPolicy — microsegmentation for OpenMath

```yaml
# k8s/network-policies/deny-all-default.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all
  namespace: openmath
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
---
# k8s/network-policies/allow-frontend-to-api.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-to-api
  namespace: openmath
spec:
  podSelector:
    matchLabels:
      app: python-api
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: angular-app
      ports:
        - port: 8000
          protocol: TCP
---
# k8s/network-policies/allow-api-to-db.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-api-to-db
  namespace: openmath
spec:
  podSelector:
    matchLabels:
      app: postgresql
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: python-api
      ports:
        - port: 5432
          protocol: TCP
---
# k8s/network-policies/allow-ingress-to-frontend.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-ingress-to-frontend
  namespace: openmath
spec:
  podSelector:
    matchLabels:
      app: angular-app
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: traefik
      ports:
        - port: 80
          protocol: TCP
```

This enforces:
- **Default deny** all traffic in the `openmath` namespace
- Frontend pods can reach the API on port 8000
- API pods can reach PostgreSQL on port 5432
- Only Traefik (ingress controller) can reach the frontend on port 80
- No pod can communicate with anything else

---

## 5. Cluster Provisioning — kubeadm on Proxmox VMs

### 5.1 VM preparation (all nodes)

```bash
# Disable swap (required for kubelet)
sudo swapoff -a
sudo sed -i '/ swap / s/^/#/' /etc/fstab

# Load required kernel modules
cat <<EOF | sudo tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF
sudo modprobe overlay
sudo modprobe br_netfilter

# Sysctl settings
cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF
sudo sysctl --system

# Install containerd (CRI)
sudo apt-get update
sudo apt-get install -y containerd
sudo mkdir -p /etc/containerd
containerd config default | sudo tee /etc/containerd/config.toml
# Set SystemdCgroup = true in [plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runc.options]
sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml
sudo systemctl restart containerd

# Install kubeadm, kubelet, kubectl
sudo apt-get install -y apt-transport-https ca-certificates curl gpg
curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.30/deb/Release.key | \
  sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg
echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.30/deb/ /' | \
  sudo tee /etc/apt/sources.list.d/kubernetes.list
sudo apt-get update
sudo apt-get install -y kubelet kubeadm kubectl
sudo apt-mark hold kubelet kubeadm kubectl
```

### 5.2 Control plane initialization

```bash
# On k8s-cp1
sudo kubeadm init \
  --control-plane-endpoint "k8s-cp1.homelab.local:6443" \
  --pod-network-cidr 10.244.0.0/16 \
  --service-cidr 10.96.0.0/12 \
  --upload-certs

# Configure kubectl
mkdir -p $HOME/.kube
sudo cp /etc/kubernetes/admin.conf $HOME/.kube/config
sudo chown $(id -u):$(id -g) $HOME/.kube/config

# Allow scheduling on control plane (small lab)
kubectl taint nodes k8s-cp1 node-role.kubernetes.io/control-plane:NoSchedule-

# Install Calico (see Section 4.2)
```

### 5.3 Worker node join

```bash
# On k8s-w1 and k8s-w2 — use the join command from kubeadm init output
sudo kubeadm join k8s-cp1.homelab.local:6443 \
  --token <token> \
  --discovery-token-ca-cert-hash sha256:<hash>
```

### 5.4 Verify cluster

```bash
kubectl get nodes -o wide
# NAME      STATUS   ROLES           AGE   VERSION   INTERNAL-IP     OS-IMAGE
# k8s-cp1   Ready    control-plane   5m    v1.30.x   192.168.1.10    Ubuntu 22.04
# k8s-w1    Ready    <none>          3m    v1.30.x   192.168.1.11    Ubuntu 22.04
# k8s-w2    Ready    <none>          3m    v1.30.x   192.168.1.12    Ubuntu 22.04

kubectl get pods -A
# Calico pods running, CoreDNS running, kube-system healthy
```

---

## 6. Container Registry Integration

The CI/CD pipeline (see `roadmap_devops.md`) builds images and pushes them to
the self-hosted **GitLab Container Registry**. Kubernetes workers pull images
from this registry.

### 6.1 Image pull secret

```bash
# Create registry credentials in the openmath namespace
kubectl create namespace openmath

kubectl create secret docker-registry gitlab-registry \
  --namespace openmath \
  --docker-server=registry.openmath.hu \
  --docker-username=deploy-token \
  --docker-password=${REGISTRY_TOKEN}
```

### 6.2 Image references in Helm values

```yaml
# helm/openmath/values.yaml (excerpt)
image:
  registry: registry.openmath.hu
  pullSecrets:
    - gitlab-registry

angularApp:
  image:
    repository: registry.openmath.hu/openmath/angular-app
    tag: "latest"        # overridden per release

pythonApi:
  image:
    repository: registry.openmath.hu/openmath/python-api
    tag: "latest"        # overridden per release
```

---

## 7. Helm Chart — OpenMath Application

### 7.1 Why Helm

| Approach | Versioned releases | Rollback | Templating | Values per env | Ecosystem |
|---|---|---|---|---|---|
| **Helm** | ✅ | `helm rollback` | Go templates | `values-prod.yaml` | Largest |
| Kustomize | ❌ (no release history) | Manual | Overlays/patches | Overlay dirs | Built-in |
| Raw manifests | ❌ | Manual | None | `sed` / `envsubst` | None |
| Jsonnet / cdk8s | ❌ | Manual | Full language | Variables | Niche |

**Decision:** Helm provides versioned releases with one-command rollback,
a massive ecosystem of community charts (for Traefik, Prometheus, Grafana, Vault),
and a clean values-file approach for environment separation.

### 7.2 Chart structure

```
helm/
└── openmath/
    ├── Chart.yaml
    ├── values.yaml                    # defaults
    ├── values-prod.yaml               # production overrides
    ├── values-staging.yaml            # staging overrides (future)
    └── templates/
        ├── _helpers.tpl
        ├── namespace.yaml
        ├── angular-app/
        │   ├── deployment.yaml
        │   ├── service.yaml
        │   └── hpa.yaml
        ├── python-api/
        │   ├── deployment.yaml
        │   ├── service.yaml
        │   └── hpa.yaml
        ├── postgresql/
        │   ├── statefulset.yaml
        │   ├── service.yaml
        │   ├── pvc.yaml
        │   └── secret.yaml
        ├── ingress.yaml
        ├── networkpolicies.yaml
        └── configmap.yaml
```

### 7.3 Chart.yaml

```yaml
# helm/openmath/Chart.yaml
apiVersion: v2
name: openmath
description: OpenMath — Math quiz platform for kids
type: application
version: 0.1.0          # chart version
appVersion: "2.8.0"     # application version

dependencies:
  - name: postgresql
    version: "15.x.x"
    repository: https://charts.bitnami.com/bitnami
    condition: postgresql.bundled
    # Use bundled Bitnami PostgreSQL or external DB via values
```

### 7.4 values.yaml (defaults)

```yaml
# helm/openmath/values.yaml

global:
  namespace: openmath
  environment: production

image:
  registry: registry.openmath.hu
  pullSecrets:
    - gitlab-registry

# ── Angular Frontend ──────────────────────────────────────
angularApp:
  replicaCount: 2
  image:
    repository: registry.openmath.hu/openmath/angular-app
    tag: "latest"
    pullPolicy: IfNotPresent
  service:
    type: ClusterIP
    port: 80
  resources:
    requests:
      cpu: 100m
      memory: 64Mi
    limits:
      cpu: 250m
      memory: 128Mi
  hpa:
    enabled: true
    minReplicas: 2
    maxReplicas: 5
    targetCPUUtilization: 70

# ── Python FastAPI Backend ────────────────────────────────
pythonApi:
  replicaCount: 2
  image:
    repository: registry.openmath.hu/openmath/python-api
    tag: "latest"
    pullPolicy: IfNotPresent
  service:
    type: ClusterIP
    port: 8000
  resources:
    requests:
      cpu: 200m
      memory: 128Mi
    limits:
      cpu: 500m
      memory: 256Mi
  hpa:
    enabled: true
    minReplicas: 2
    maxReplicas: 8
    targetCPUUtilization: 70
  env:
    CORS_ORIGINS: "https://openmath.hu"
    JWT_ALGORITHM: "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: "15"
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: "7"
    DEBUG: "false"

# ── PostgreSQL ────────────────────────────────────────────
postgresql:
  bundled: true           # use Bitnami subchart; set false for external DB
  auth:
    existingSecret: openmath-db-secret
    secretKeys:
      userPasswordKey: password
  primary:
    persistence:
      enabled: true
      size: 20Gi
      storageClass: longhorn        # or local-path
    resources:
      requests:
        cpu: 200m
        memory: 256Mi
      limits:
        cpu: 1000m
        memory: 512Mi

# ── Ingress ───────────────────────────────────────────────
ingress:
  enabled: true
  className: traefik
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    traefik.ingress.kubernetes.io/router.tls: "true"
  hosts:
    - host: openmath.hu
      paths:
        - path: /
          pathType: Prefix
          service: angular-app
  tls:
    - secretName: openmath-tls
      hosts:
        - openmath.hu

# ── Network Policies ─────────────────────────────────────
networkPolicies:
  enabled: true
```

### 7.5 Key templates

#### Deployment — python-api

```yaml
# helm/openmath/templates/python-api/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "openmath.fullname" . }}-python-api
  namespace: {{ .Values.global.namespace }}
  labels:
    app: python-api
    {{- include "openmath.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.pythonApi.replicaCount }}
  selector:
    matchLabels:
      app: python-api
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1
  template:
    metadata:
      labels:
        app: python-api
    spec:
      imagePullSecrets:
        {{- toYaml .Values.image.pullSecrets | nindent 8 }}
      containers:
        - name: python-api
          image: "{{ .Values.pythonApi.image.repository }}:{{ .Values.pythonApi.image.tag }}"
          imagePullPolicy: {{ .Values.pythonApi.image.pullPolicy }}
          ports:
            - containerPort: 8000
              protocol: TCP
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: openmath-db-secret
                  key: database-url
            - name: JWT_SECRET_KEY
              valueFrom:
                secretKeyRef:
                  name: openmath-jwt-secret
                  key: jwt-secret-key
            {{- range $key, $val := .Values.pythonApi.env }}
            - name: {{ $key }}
              value: {{ $val | quote }}
            {{- end }}
          resources:
            {{- toYaml .Values.pythonApi.resources | nindent 12 }}
          livenessProbe:
            httpGet:
              path: /api/health
              port: 8000
            initialDelaySeconds: 15
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /api/health
              port: 8000
            initialDelaySeconds: 5
            periodSeconds: 10
          securityContext:
            readOnlyRootFilesystem: true
            runAsNonRoot: true
            runAsUser: 1000
            allowPrivilegeEscalation: false
            capabilities:
              drop:
                - ALL
      volumes: []
```

#### HPA — python-api

```yaml
# helm/openmath/templates/python-api/hpa.yaml
{{- if .Values.pythonApi.hpa.enabled }}
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: {{ include "openmath.fullname" . }}-python-api
  namespace: {{ .Values.global.namespace }}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: {{ include "openmath.fullname" . }}-python-api
  minReplicas: {{ .Values.pythonApi.hpa.minReplicas }}
  maxReplicas: {{ .Values.pythonApi.hpa.maxReplicas }}
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: {{ .Values.pythonApi.hpa.targetCPUUtilization }}
{{- end }}
```

#### Ingress

```yaml
# helm/openmath/templates/ingress.yaml
{{- if .Values.ingress.enabled }}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ include "openmath.fullname" . }}-ingress
  namespace: {{ .Values.global.namespace }}
  annotations:
    {{- toYaml .Values.ingress.annotations | nindent 4 }}
spec:
  ingressClassName: {{ .Values.ingress.className }}
  tls:
    {{- toYaml .Values.ingress.tls | nindent 4 }}
  rules:
    {{- range .Values.ingress.hosts }}
    - host: {{ .host | quote }}
      http:
        paths:
          {{- range .paths }}
          - path: {{ .path }}
            pathType: {{ .pathType }}
            backend:
              service:
                name: {{ include "openmath.fullname" $ }}-{{ .service }}
                port:
                  number: 80
          {{- end }}
    {{- end }}
{{- end }}
```

### 7.6 Helm install / upgrade commands

```bash
# First install
helm install openmath ./helm/openmath \
  --namespace openmath \
  --create-namespace \
  -f helm/openmath/values-prod.yaml

# Upgrade (new image tag from CI/CD)
helm upgrade openmath ./helm/openmath \
  --namespace openmath \
  -f helm/openmath/values-prod.yaml \
  --set pythonApi.image.tag=v2.8.1 \
  --set angularApp.image.tag=v2.8.1

# Rollback to previous release
helm rollback openmath 1

# View release history
helm history openmath -n openmath
```

---

## 8. Storage — Persistent Volumes

### 8.1 Storage options for on-premises K8s

| Solution | Type | Multi-node | Replication | Complexity | Home-lab fit |
|---|---|---|---|---|---|
| **Longhorn** (Rancher) | Distributed block | ✅ | ✅ (replica count) | Low | **Best** |
| OpenEBS | Distributed block | ✅ | ✅ | Medium | Good |
| Rook-Ceph | Distributed block/object | ✅ | ✅ | High | Overkill |
| NFS (manual) | Shared filesystem | ✅ | ❌ | Low | Simple |
| local-path-provisioner | Local disk | ❌ | ❌ | Minimal | Dev/test |

**Decision:** **Longhorn** — lightweight distributed storage designed for
Kubernetes. Provides replicated block volumes across worker nodes, snapshots,
backup to S3-compatible storage, and a web UI. Installs via Helm chart.

### 8.2 Longhorn installation

```bash
helm repo add longhorn https://charts.longhorn.io
helm repo update

helm install longhorn longhorn/longhorn \
  --namespace longhorn-system \
  --create-namespace \
  --set defaultSettings.defaultReplicaCount=2
```

### 8.3 StorageClass for OpenMath

```yaml
# Created automatically by Longhorn — verify:
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: longhorn
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"
provisioner: driver.longhorn.io
reclaimPolicy: Retain
volumeBindingMode: Immediate
parameters:
  numberOfReplicas: "2"
  staleReplicaTimeout: "30"
```

PostgreSQL PVC will use `storageClass: longhorn` to get replicated persistent
storage across nodes.

---

## 9. Ingress Controller — Traefik on Kubernetes

The Docker-based Traefik deployment (see `roadmap_application_gateway_publish.md`)
migrates to the **Traefik Kubernetes Ingress Controller** deployed via Helm.

### 9.1 Traefik Helm installation

```bash
helm repo add traefik https://traefik.github.io/charts
helm repo update

helm install traefik traefik/traefik \
  --namespace traefik \
  --create-namespace \
  --set ports.web.redirectTo.port=websecure \
  --set ports.websecure.tls.enabled=true \
  --set service.type=NodePort \
  --set service.nodePorts.web=80 \
  --set service.nodePorts.websecure=443
```

In a home-lab without a cloud LoadBalancer, Traefik uses `NodePort` or
`hostPort` to bind to ports 80/443 directly on the worker nodes. The MikroTik
router port-forwards WAN traffic to these nodes.

### 9.2 cert-manager for Let's Encrypt

```bash
helm repo add jetstack https://charts.jetstack.io
helm repo update

helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --set crds.enabled=true

# ClusterIssuer for Let's Encrypt
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@openmath.hu
    privateKeySecretRef:
      name: letsencrypt-prod-key
    solvers:
      - http01:
          ingress:
            class: traefik
EOF
```

---

## 10. Secrets Management — Vault Integration

The HashiCorp Vault deployment (see `roadmap_security.md`) integrates with
Kubernetes via the **External Secrets Operator** (ESO).

### 10.1 External Secrets Operator

```bash
helm repo add external-secrets https://charts.external-secrets.io
helm repo update

helm install external-secrets external-secrets/external-secrets \
  --namespace external-secrets \
  --create-namespace
```

### 10.2 SecretStore + ExternalSecret

```yaml
# k8s/secrets/vault-secret-store.yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: vault-backend
  namespace: openmath
spec:
  provider:
    vault:
      server: "http://vault.vault-system.svc:8200"
      path: "openmath"
      version: "v2"
      auth:
        kubernetes:
          mountPath: "kubernetes"
          role: "openmath-api"
---
# k8s/secrets/openmath-db-secret.yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: openmath-db-secret
  namespace: openmath
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: vault-backend
    kind: SecretStore
  target:
    name: openmath-db-secret
  data:
    - secretKey: database-url
      remoteRef:
        key: database
        property: DATABASE_URL
    - secretKey: password
      remoteRef:
        key: database
        property: POSTGRES_PASSWORD
---
# k8s/secrets/openmath-jwt-secret.yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: openmath-jwt-secret
  namespace: openmath
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: vault-backend
    kind: SecretStore
  target:
    name: openmath-jwt-secret
  data:
    - secretKey: jwt-secret-key
      remoteRef:
        key: jwt
        property: JWT_SECRET_KEY
```

---

## 11. Monitoring Stack on Kubernetes

The OTEL monitoring stack (see `roadmap_observability_otel_monitoring.md`)
deploys on Kubernetes via Helm charts instead of Docker Compose.

### 11.1 kube-prometheus-stack (Prometheus + Grafana)

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --set grafana.adminPassword=${GRAFANA_PASSWORD} \
  --set prometheus.prometheusSpec.retention=30d \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.storageClassName=longhorn \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=20Gi
```

### 11.2 Loki (log aggregation)

```bash
helm repo add grafana https://grafana.github.io/helm-charts
helm install loki grafana/loki \
  --namespace monitoring \
  --set loki.storage.type=filesystem \
  --set singleBinary.replicas=1
```

### 11.3 OpenTelemetry Collector

```bash
helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
helm install otel-collector open-telemetry/opentelemetry-collector \
  --namespace monitoring \
  --set mode=deployment \
  --set config.exporters.prometheus.endpoint="0.0.0.0:8889"
```

---

## 12. CI/CD Integration — GitLab to Kubernetes

The GitLab CI/CD pipeline (see `roadmap_devops.md`) extends with a Helm
deployment stage that deploys to the Kubernetes cluster.

### 12.1 GitLab CI pipeline with Helm deploy

```yaml
# .gitlab-ci.yml — deploy stage addition
stages:
  - lint
  - test
  - build
  - push
  - deploy

deploy-production:
  stage: deploy
  image: alpine/helm:3.14
  environment:
    name: production
    url: https://openmath.hu
  before_script:
    - apk add --no-cache kubectl
    - echo "${KUBE_CONFIG}" | base64 -d > /tmp/kubeconfig
    - export KUBECONFIG=/tmp/kubeconfig
  script:
    - helm upgrade --install openmath ./helm/openmath
        --namespace openmath
        --create-namespace
        -f helm/openmath/values-prod.yaml
        --set pythonApi.image.tag=${CI_COMMIT_SHORT_SHA}
        --set angularApp.image.tag=${CI_COMMIT_SHORT_SHA}
        --wait
        --timeout 300s
  only:
    - main
  when: manual        # manual gate for production deploys
```

### 12.2 Deployment flow

```
┌────────────────────────────────────────────────────────────────────────┐
│  GitLab CE (self-hosted)                                               │
│                                                                        │
│  git push → Pipeline                                                   │
│  ┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐  ┌────────────────────┐  │
│  │ Lint  ├─►│ Test  ├─►│ Build ├─►│ Push  ├─►│ Deploy (Helm)      │  │
│  │semgrep│  │pytest │  │docker │  │GitLab │  │helm upgrade        │  │
│  │trivy  │  │jest   │  │build  │  │registry│  │--set tag=$SHA     │  │
│  └───────┘  └───────┘  └───────┘  └───────┘  └────────┬───────────┘  │
└─────────────────────────────────────────────────────────┼──────────────┘
                                                          │ kubectl apply
┌─────────────────────────────────────────────────────────▼──────────────┐
│  Kubernetes Cluster (Proxmox VMs)                                      │
│                                                                        │
│  namespace: openmath                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │ angular-app  │  │ python-api   │  │ postgresql   │                  │
│  │ Deployment   │  │ Deployment   │  │ StatefulSet  │                  │
│  │ 2 replicas   │  │ 2 replicas   │  │ 1 replica    │                  │
│  └──────────────┘  └──────────────┘  └──────────────┘                  │
│                                                                        │
│  Rolling update: new pods created → health check → old pods terminated │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 13. Migration Strategy — Docker Compose to Kubernetes

### 13.1 Migration phases

The migration is **incremental** — Docker Compose remains the production
environment until Kubernetes is validated.

| Phase | Duration | What happens | Risk |
|---|---|---|---|
| **Phase 0** — Provision cluster | 1 day | Create Proxmox VMs, install kubeadm, Calico, verify `kubectl get nodes` | Low |
| **Phase 1** — Infra services | 1 day | Deploy Longhorn, Traefik Ingress, cert-manager via Helm | Low |
| **Phase 2** — Deploy app (staging) | 1 day | Helm install OpenMath into `openmath-staging` namespace, run smoke tests | Low |
| **Phase 3** — Data migration | 0.5 day | `pg_dump` from Docker PostgreSQL → `pg_restore` into K8s PostgreSQL PVC | Medium |
| **Phase 4** — DNS cutover | 0.5 day | Point `openmath.hu` DNS to K8s Traefik NodePort IPs | Medium |
| **Phase 5** — Monitoring migration | 1 day | Deploy kube-prometheus-stack, Loki, OTEL Collector via Helm | Low |
| **Phase 6** — Secrets migration | 0.5 day | Deploy External Secrets Operator, connect to Vault, remove `.env` files | Medium |
| **Phase 7** — Network policies | 0.5 day | Apply Calico NetworkPolicies, test connectivity matrix | Medium |
| **Phase 8** — Decommission Docker | 0.5 day | Stop Docker Compose stack, retain as fallback for 30 days, then remove | Low |

### 13.2 Database migration procedure

```bash
# 1. On Docker host — dump production database
docker exec openmath-local-prod-db \
  pg_dump -U quiz -Fc quiz > /backups/migration_$(date +%Y%m%d).dump

# 2. Copy dump to a K8s-accessible location
scp /backups/migration_*.dump k8s-cp1:/tmp/

# 3. On K8s — copy dump into PostgreSQL pod
kubectl cp /tmp/migration_*.dump \
  openmath/postgresql-0:/tmp/migration.dump

# 4. Restore inside the pod
kubectl exec -it -n openmath postgresql-0 -- \
  pg_restore -U quiz -d quiz -c /tmp/migration.dump

# 5. Verify
kubectl exec -it -n openmath postgresql-0 -- \
  psql -U quiz -c "SELECT count(*) FROM users;"
```

### 13.3 Rollback plan

If the Kubernetes deployment fails after DNS cutover:

1. Revert DNS `openmath.hu` A record to the Docker host IP
2. Start Docker Compose stack: `docker compose -f docker-compose.prod.yml up -d`
3. Service restored within DNS TTL (set TTL to 300s / 5 min before migration)

The Docker host and its volumes remain untouched during the migration window.

---

## 14. Resource Planning

### 14.1 Pod resource budget

| Component | Replicas | CPU request | CPU limit | Memory request | Memory limit |
|---|---|---|---|---|---|
| angular-app | 2 | 100m | 250m | 64Mi | 128Mi |
| python-api | 2 | 200m | 500m | 128Mi | 256Mi |
| postgresql | 1 | 200m | 1000m | 256Mi | 512Mi |
| otel-collector | 1 | 100m | 250m | 128Mi | 256Mi |
| prometheus | 1 | 200m | 500m | 256Mi | 512Mi |
| grafana | 1 | 100m | 250m | 128Mi | 256Mi |
| loki | 1 | 100m | 250m | 128Mi | 256Mi |
| traefik | 1 | 100m | 250m | 64Mi | 128Mi |
| **Total** | **10** | **1200m** | **3250m** | **1216Mi** | **2304Mi** |

The 3-node cluster with 8 vCPU (8000m) and 12 GB allocatable RAM has ample
headroom for this workload plus HPA scaling.

### 14.2 Namespace strategy

| Namespace | Contents |
|---|---|
| `openmath` | Application workloads (angular-app, python-api, postgresql) |
| `openmath-staging` | Staging environment (future, identical manifests, separate DB) |
| `traefik` | Traefik Ingress Controller |
| `monitoring` | Prometheus, Grafana, Loki, OTEL Collector |
| `cert-manager` | cert-manager + ClusterIssuers |
| `longhorn-system` | Longhorn storage provisioner |
| `vault-system` | Vault (if running inside K8s) or External Secrets Operator |
| `external-secrets` | External Secrets Operator |

---

## 15. Day-2 Operations

### 15.1 Cluster upgrades

```bash
# Upgrade kubeadm + kubelet on control plane first, then workers
sudo apt-get update
sudo apt-get install -y kubeadm=1.31.x-*
sudo kubeadm upgrade plan
sudo kubeadm upgrade apply v1.31.x

# Drain and upgrade each worker node
kubectl drain k8s-w1 --ignore-daemonsets --delete-emptydir-data
# SSH to k8s-w1, upgrade kubelet + kubectl, restart kubelet
kubectl uncordon k8s-w1
```

### 15.2 Backup strategy

| What | Tool | Schedule | Target |
|---|---|---|---|
| PostgreSQL data | `pg_dump` CronJob in K8s | Daily 02:00 | Longhorn volume + off-cluster NFS |
| etcd (cluster state) | `etcdctl snapshot save` | Daily 03:00 | Off-cluster NFS |
| Longhorn volumes | Longhorn recurring backup | Daily 04:00 | NFS or S3-compatible (MinIO) |
| Helm release history | `helm get all` export | Per deploy | GitLab CI artifacts |

#### PostgreSQL CronJob

```yaml
# helm/openmath/templates/postgresql/backup-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: pg-backup
  namespace: openmath
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: pg-backup
              image: postgres:16-alpine
              command:
                - /bin/sh
                - -c
                - |
                  pg_dump -U $PGUSER -h postgresql -Fc $PGDATABASE \
                    > /backups/quiz_$(date +%Y%m%d_%H%M%S).dump
                  # Keep last 30 backups
                  ls -t /backups/*.dump | tail -n +31 | xargs rm -f
              envFrom:
                - secretRef:
                    name: openmath-db-secret
              volumeMounts:
                - name: backup-volume
                  mountPath: /backups
          restartPolicy: OnFailure
          volumes:
            - name: backup-volume
              persistentVolumeClaim:
                claimName: pg-backup-pvc
```

### 15.3 Troubleshooting commands

```bash
# Cluster health
kubectl get nodes
kubectl top nodes
kubectl get pods -A -o wide

# OpenMath application
kubectl get all -n openmath
kubectl logs -n openmath deployment/openmath-python-api --tail=100 -f
kubectl describe pod -n openmath <pod-name>

# Network debugging
kubectl run netshoot --rm -it --image=nicolaka/netshoot -- /bin/bash
# Inside: curl http://python-api.openmath.svc:8000/api/health

# Helm releases
helm list -A
helm history openmath -n openmath
helm get values openmath -n openmath
```

---

## 16. Implementation Phases

| Phase | What | Effort | Priority | Depends on |
|---|---|---|---|---|
| **Phase 1** | Provision Proxmox VMs (3 nodes), install kubeadm, deploy Calico | 1 day | High | Proxmox host |
| **Phase 2** | Install Longhorn storage, verify PVC provisioning | 0.5 day | High | Phase 1 |
| **Phase 3** | Deploy Traefik Ingress Controller + cert-manager via Helm | 0.5 day | High | Phase 1 |
| **Phase 4** | Create OpenMath Helm chart, deploy to `openmath-staging` namespace | 1–2 days | High | Phases 1–3 |
| **Phase 5** | Deploy monitoring stack (kube-prometheus-stack, Loki, OTEL) via Helm | 1 day | High | Phase 1 |
| **Phase 6** | Deploy External Secrets Operator, connect to Vault | 0.5 day | Medium | Vault deployed |
| **Phase 7** | Apply Calico NetworkPolicies, test traffic matrix | 0.5 day | Medium | Phase 4 |
| **Phase 8** | Data migration: pg_dump → pg_restore into K8s PostgreSQL | 0.5 day | High | Phase 4 |
| **Phase 9** | DNS cutover, smoke tests, production validation | 0.5 day | High | Phase 8 |
| **Phase 10** | GitLab CI/CD Helm deploy stage integration | 0.5 day | Medium | GitLab CE + Phase 4 |
| **Phase 11** | HPA tuning, resource limit validation, load testing | 1 day | Medium | Phase 9 |
| **Phase 12** | Docker Compose decommission (after 30-day parallel run) | 0.5 day | Low | Phase 9 + 30 days |

**Total estimated effort:** 8–10 days

---

## 17. Checklist

### Prerequisites (from other roadmaps)

- [ ] Docker production stack running (`roadmap_devops.md`)
- [ ] GitLab CE self-hosted with container registry (`roadmap_devops.md`)
- [ ] CI/CD pipeline: lint → test → build → push (`roadmap_devops.md`)
- [ ] HashiCorp Vault deployed with OpenMath secrets (`roadmap_security.md`)
- [ ] Traefik TLS strategy validated on Docker first (`roadmap_application_gateway_publish.md`)
- [ ] OTEL monitoring stack design finalized (`roadmap_observability_otel_monitoring.md`)

### Cluster provisioning

- [ ] Proxmox VMs created (3 nodes: cp1, w1, w2)
- [ ] Ubuntu 22.04 installed, swap disabled, kernel modules loaded
- [ ] containerd installed and configured (SystemdCgroup)
- [ ] kubeadm, kubelet, kubectl installed on all nodes
- [ ] Control plane initialized, workers joined
- [ ] Calico CNI installed, all nodes `Ready`
- [ ] kubectl works from developer workstation

### Platform services

- [ ] Longhorn installed, default StorageClass verified
- [ ] Traefik Ingress Controller deployed via Helm
- [ ] cert-manager deployed, ClusterIssuer for Let's Encrypt created
- [ ] TLS certificate auto-provisioned for `openmath.hu`
- [ ] External Secrets Operator deployed, connected to Vault

### Application deployment

- [ ] OpenMath Helm chart created and linted (`helm lint`)
- [ ] Staging deployment successful in `openmath-staging`
- [ ] Production deployment successful in `openmath`
- [ ] Rolling update tested (zero-downtime verified)
- [ ] Rollback tested (`helm rollback`)
- [ ] PostgreSQL PVC on Longhorn, data persists across pod restarts

### Security & networking

- [ ] Default-deny NetworkPolicy applied in `openmath` namespace
- [ ] Frontend → API traffic allowed (port 8000)
- [ ] API → PostgreSQL traffic allowed (port 5432)
- [ ] Ingress → Frontend traffic allowed (port 80)
- [ ] All other traffic denied (verified with `netshoot`)
- [ ] Pod security: `readOnlyRootFilesystem`, `runAsNonRoot`, `drop ALL`

### Monitoring & operations

- [ ] kube-prometheus-stack deployed, Grafana accessible
- [ ] Loki deployed, application logs queryable
- [ ] OTEL Collector deployed, receiving traces from python-api
- [ ] PostgreSQL backup CronJob running, backups verified
- [ ] etcd backup script running on control plane
- [ ] Cluster upgrade procedure documented and tested

### CI/CD integration

- [ ] GitLab CI `deploy` stage uses `helm upgrade --install`
- [ ] Image tags set to `$CI_COMMIT_SHORT_SHA` per deploy
- [ ] Production deploy requires manual approval gate
- [ ] Deployment notification sent to monitoring channel

### Migration complete

- [ ] DNS cutover from Docker host to K8s Traefik
- [ ] 30-day parallel operation window passed
- [ ] Docker Compose stack decommissioned
- [ ] Migration retrospective documented