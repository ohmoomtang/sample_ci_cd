# Sample CI/CD Pipeline

A GitHub Actions–based CI/CD pipeline for a Node.js application. It runs tests, builds and pushes a Docker image to GitHub Container Registry (GHCR), and performs GitOps-style deployments to Kubernetes using Argo Rollouts with a canary strategy.

---

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         GitHub Repository                           │
│                                                                     │
│   push / pull_request → main                                        │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Job: ci  (runs on every push & PR)                                  │
│                                                                      │
│  1. Checkout repository                                              │
│  2. Setup Node.js 20                                                 │
│  3. npm install                                                      │
│  4. npm test                                                         │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ success
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Job: build  (needs: ci)                                             │
│                                                                      │
│  1. Checkout repository                                              │
│  2. Login to GHCR (ghcr.io)                                         │
│  3. Build Docker image                                               │
│  4. Push image with two tags:                                        │
│       ghcr.io/<actor>/demo-app:latest                                │
│       ghcr.io/<actor>/demo-app:<git-sha>                             │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ success  (push to main only)
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Job: update-manifest  (needs: build, env: production)               │
│                                                                      │
│  1. Checkout repository                                              │
│  2. Update k8s/deployment.yaml image tag → <git-sha>                │
│  3. Commit & push changes back to main                               │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ GitOps sync
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Argo CD (watches repository)                                        │
│                                                                      │
│  Detects manifest change → triggers Argo Rollout                     │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Argo Rollouts — Canary Deployment                                   │
│                                                                      │
│  Step 1: Route 20% traffic to canary  →  wait 30s                   │
│  Step 2: Route 50% traffic to canary  →  wait 30s                   │
│  Step 3: Route 100% traffic to canary (promote to stable)            │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Repository Structure

```
.
├── .dockerignore                    # Files excluded from Docker build context
├── .github/
│   └── workflows/
│       └── cicd.yaml                # GitHub Actions pipeline definition
├── Dockerfile                       # Container image build instructions
└── k8s/
    └── deployment.yaml              # Argo Rollout manifest (canary strategy)
```

---

## Prerequisites

| Tool | Purpose |
|---|---|
| GitHub repository | Source of truth; hosts Actions and the K8s manifest |
| GitHub Container Registry (GHCR) | Stores Docker images |
| Kubernetes cluster | Target runtime (e.g., k3s) |
| Argo CD | Watches the repo and syncs manifest changes to the cluster |
| Argo Rollouts | Manages canary deployments inside the cluster |
| Argo Rollouts NGINX integration | Splits traffic between stable and canary services |

---

## Setup Instructions

### 1. Repository Secrets & Environments

No additional secrets are required for GHCR — the pipeline uses the built-in `GITHUB_TOKEN`.

Create a **GitHub Environment** named `production`:

1. Go to **Settings → Environments → New environment**.
2. Name it `production`.
3. Optionally add required reviewers for manual approval before deployments.

### 2. Argo CD

Install Argo CD on your cluster and create an Application that points to this repository:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: demo-app
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/<your-org>/<your-repo>
    targetRevision: main
    path: k8s
  destination:
    server: https://kubernetes.default.svc
    namespace: default
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

### 3. Argo Rollouts

Install the Argo Rollouts controller and the NGINX traffic-routing plugin:

```bash
kubectl create namespace argo-rollouts
kubectl apply -n argo-rollouts \
  -f https://github.com/argoproj/argo-rollouts/releases/latest/download/install.yaml
```

Create the two Services referenced by [k8s/deployment.yaml](k8s/deployment.yaml) (stable + canary) and an NGINX Ingress named `demo-app` before the first rollout.

### 4. Trigger the Pipeline

Push a commit to `main` (or open a PR to run CI only):

```bash
git add .
git commit -m "your change"
git push origin main
```

---

## How the Canary Strategy Works

The Argo Rollout in [k8s/deployment.yaml](k8s/deployment.yaml) uses NGINX Ingress to gradually shift traffic:

| Step | Canary traffic | Wait |
|---|---|---|
| 1 | 20% | 30 s |
| 2 | 50% | 30 s |
| 3 | 100% | — (promotion complete) |

If a rollout needs to be aborted, use:

```bash
kubectl argo rollouts abort demo-app
kubectl argo rollouts undo demo-app   # roll back to previous stable
```

---

## Pipeline Behavior by Event

| Event | `ci` | `build` | `update-manifest` |
|---|---|---|---|
| Pull request to `main` | ✅ runs | ✅ runs | ❌ skipped |
| Push to `main` | ✅ runs | ✅ runs | ✅ runs |
