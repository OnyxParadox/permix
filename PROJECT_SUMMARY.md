# PermiX Project Summary

## Project goal

PermiX is a Linux permissions calculator and visualizer designed to help users understand how file permission bits map to octal, symbolic, and human-readable access rules.

## Primary features

- Owner, group, and others permission controls
- Octal conversion logic for common and special modes
- Symbolic representation output
- Special bit support for setuid, setgid, and sticky
- Preset permission definitions
- Terminal-style dark UI
- Copy-friendly permission output for shell usage
- Docker deployment support

## Architecture

The app is built as a static React frontend served by Nginx inside a container. The logic is organized into reusable permission helpers so the conversion rules remain deterministic and easy to validate.

## Typical examples supported

- 000
- 600
- 644
- 700
- 755
- 777
- 4755
- 2755
- 1777

## Development workflow

```bash
npm install
npm run dev
```

## Build workflow

```bash
npm run build
```

## Deployment workflow

```bash
docker build -t permix:latest .
docker run --rm -d -p 8082:80 --name permix-app permix:latest
```

## Current status

The frontend app is implemented and the container deployment is functional. The project is suitable for local testing, Docker-based deployment practice, and public image publishing through Docker Hub.

## Limitations

- This is a frontend-only utility, not a backend service.
- It is designed for permission education and conversion tasks, not for managing live filesystem ACLs.
- Browser-based usage depends on the client environment and user input.
