FROM docker.io/checkmarx/kics:v2.1.20@sha256:3e5a268eb8adda2e5a483c9359ddfc4cd520ab856a7076dc0b1d8784a37e2602 AS kics-env

FROM cgr.dev/chainguard/wolfi-base@sha256:70750dfde91b4c5804b4df269121253fbdff73a9122925c7acc067aa33f9f55e

COPY --from=kics-env /app /app

COPY ./entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

COPY ./ /app

ENTRYPOINT ["/entrypoint.sh"]
