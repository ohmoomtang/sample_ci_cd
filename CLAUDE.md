# CLAUDE.md

This file gives Claude context about this repository.

## Purpose

A sample CI/CD pipeline project used to demonstrate a complete GitOps workflow. It is intended as a learning/reference example, not a production application.

## Stack

- **App runtime**: Node.js 20
- **Containerization**: Docker (node:20-alpine base image), image hosted on GHCR
- **CI/CD**: GitHub Actions (`.github/workflows/cicd.yaml`)
- **Deployment target**: Kubernetes (k3s)
- **GitOps controller**: Argo CD
- **Progressive delivery**: Argo Rollouts with canary strategy via NGINX Ingress

## Pipeline Overview

Three sequential GitHub Actions jobs:
1. `ci` — install deps and run tests (`npm test`)
2. `build` — build and push Docker image to `ghcr.io/ohmoomtang/demo-app`
3. `update-manifest` — update the image SHA in `k8s/deployment.yaml` and push back to `main` (push-to-main only, requires `production` environment approval)

Argo CD watches `main` and syncs `k8s/` changes to the cluster. Argo Rollouts handles the canary progression (20% → 50% → 100%).

## Key Files

| File | Role |
|---|---|
| `.github/workflows/cicd.yaml` | Full pipeline definition |
| `Dockerfile` | Container image build (node:20-alpine, port 3000, entrypoint `index.js`) |
| `k8s/deployment.yaml` | Argo Rollout manifest — canary strategy, 5 replicas |
| `.dockerignore` | Excludes `node_modules/`, `.git/`, `*.log`, `.env` |

## Notes for Future Work

- The project has no application source files (`index.js`, `package.json`) — they are implied by the Dockerfile and pipeline but not present. If adding them, keep the entrypoint as `index.js` and port as `3000` to stay consistent with the Dockerfile.
- The `update-manifest` job writes the git SHA back to `k8s/deployment.yaml` via `sed`. The sed pattern targets `demo-app:.*`, so the image name in `deployment.yaml` must always start with `demo-app:`.
- Argo Rollouts requires two Services (`demo-app` stable + `demo-app-canary`) and an NGINX Ingress named `demo-app` to exist before the first rollout. These are not in this repo.
