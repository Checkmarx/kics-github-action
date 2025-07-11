FROM checkmarx/kics:v2.1.11 as kics-env
 
FROM cgr.dev/chainguard/wolfi-base:latest
 
COPY --from=kics-env /app /app
 
COPY ./entrypoint.sh /entrypoint.sh
 
RUN chmod +x /entrypoint.sh
 
COPY ./ /app
 
ENTRYPOINT ["/entrypoint.sh"]
