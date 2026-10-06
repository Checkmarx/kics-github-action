FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS builder

WORKDIR /build

COPY package.json package-lock.json ./
RUN npm ci

COPY src ./src
RUN npm run build

FROM docker.io/checkmarx/kics:v2.1.20@sha256:3e5a268eb8adda2e5a483c9359ddfc4cd520ab856a7076dc0b1d8784a37e2602 AS kics-env

FROM cgr.dev/chainguard/node:latest@sha256:f6aa5d5b1fa68ab77a3512b606534e22a8afc3a04fb22db95430bb850e433664

USER root

COPY --from=kics-env /app /app
COPY --from=builder /build/dist /app/dist

COPY ./entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
