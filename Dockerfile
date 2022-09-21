ARG KICS_IMAGE=checkmarx/kics:gh-action

FROM $KICS_IMAGE

COPY ./entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

COPY ./ /app

ENTRYPOINT ["/entrypoint.sh"]
