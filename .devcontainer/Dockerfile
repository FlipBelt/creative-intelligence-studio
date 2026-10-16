# Docker Hub multi-architecture manifest, resolved 2026-10-16.
FROM node:24.15.0-bookworm@sha256:f22d6a1f082c02f292e86929b5b0442ac2e5eaf438a5dea9b1566601c3e05940

RUN npm install --global npm@11.19.0 --ignore-scripts --no-audit --no-fund

ENV NEXT_TELEMETRY_DISABLED=1
USER node
