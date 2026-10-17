# Docker Deployment Guide

This document explains how to build, run, and publish the PermiX app as a Docker image.

## Local build

```bash
docker build -t permix:latest .
```

## Run locally

```bash
docker run --rm -d -p 8082:80 --name permix-app permix:latest
```

Then open:

```text
http://localhost:8082/
```

## Docker Compose

```bash
docker compose up --build -d
```

If you want to stop it:

```bash
docker compose down
```

## Docker Hub publish

1. Log in to Docker Hub:

```bash
docker login -u srujan86
```

2. Use a PAT if prompted instead of a password.

3. Tag the image:

```bash
docker tag permix:latest srujan86/permix:latest
```

4. Push the image:

```bash
docker push srujan86/permix:latest
```

5. Run the published image anywhere:

```bash
docker run --rm -d -p 8082:80 --name permix-app srujan86/permix:latest
```

## Port conflict troubleshooting

If the port is already allocated:

```bash
docker ps
```

Then either stop the existing container:

```bash
docker rm -f permix-app
```

Or choose another host port:

```bash
docker run --rm -d -p 8083:80 --name permix-app-2 srujan86/permix:latest
```

## Common port issue

A common error is:

```text
port is already allocated
```

This means another container is already using that port. Use `docker ps` to inspect active containers, then either remove the conflicting container or switch to a free port.
