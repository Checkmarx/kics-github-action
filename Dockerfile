FROM node:26-alpine@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216 AS builder

WORKDIR /build

COPY package.json package-lock.json ./
# Optional npmrc secret, only used on runners that cannot reach registry.npmjs.org directly
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc,required=false npm ci

COPY src ./src
RUN npm run build

FROM docker.io/checkmarx/kics:v2.2.1@sha256:49ccc54b6ae7f5d5fc95e96f8f95c18c57f3bba047ab611a03d80792bdff6757 AS kics-env

FROM cgr.dev/chainguard/node:latest@sha256:6a066f8decea77c67ef2772a78fad81df7a78a346d0b22a05fc9dac14537f2b0

USER root

COPY --from=kics-env /app /app
COPY --from=builder /build/dist /app/dist

COPY ./entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
