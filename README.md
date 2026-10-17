# PermiX

PermiX is a polished frontend web app for understanding, converting, and validating Linux file and directory permissions. It helps users translate between numeric octal mode values, symbolic notation, and permission explanations in a clear visual interface.

## Features

- Interactive permission matrix for owner, group, and others
- Numeric octal conversion and validation
- Symbolic permission display
- Special bits support for setuid, setgid, and sticky
- Common preset modes such as 000, 600, 644, 700, 755, 777
- Advanced examples including 4755, 2755, and 1777
- Copy-to-clipboard output for terminal-friendly commands
- Clean dark terminal-inspired UI
- Docker-ready static deployment

## Why this project exists

Linux permissions can be confusing because the same access model is represented in multiple ways:

- Octal: 755
- Symbolic: rwxr-xr-x
- Human-readable explanation: user can read/write, group can read/execute, others can read/execute

PermiX makes these conversions easy to inspect and compare.

## Tech stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Nginx (for Docker deployment)

## Quick start

### Install dependencies

```bash
npm install
```

### Run locally

```bash
npm run dev
```

Then open the local Vite URL displayed in the terminal.

### Production build

```bash
npm run build
```

### Linting

```bash
npm run lint
```

## Docker

### Build the image

```bash
docker build -t permix:latest .
```

### Run locally

```bash
docker run --rm -d -p 8082:80 --name permix-app permix:latest
```

Then open:

```text
http://localhost:8082/
```

## Common permission examples

The app is designed to correctly interpret and explain:

- 000
- 600
- 644
- 700
- 755
- 777
- 4755
- 2755
- 1777

## Example outputs

```bash
chmod 755 script.sh
chmod 600 ~/.ssh/id_rsa
chmod 1777 /tmp
```

## Project structure

```text
.
├── Dockerfile
├── docker-compose.yml
├── nginx/
│   └── default.conf
├── public/
├── src/
│   ├── App.tsx
│   ├── data/
│   ├── lib/
│   ├── index.css
│   └── main.tsx
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md
```

## Notes

- The project is optimized as a frontend-only static application.
- It runs behind Nginx in Docker for simple deployment to a container host.
- Port conflicts can happen when another local service is already using the target port. In that case, switch to another free port like 8082 or 8083.

## License

This project is intended for learning, practice, and personal use.
