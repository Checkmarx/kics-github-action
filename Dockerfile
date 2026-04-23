FROM docker.io/checkmarx/kics:v2.1.19@sha256:7b0a4d750acd491942ce9de52c1183fbf4451c1c936780ec2cfacd2650e7d84c AS kics-env

FROM cgr.dev/chainguard/wolfi-base:latest@sha256:70750dfde91b4c5804b4df269121253fbdff73a9122925c7acc067aa33f9f55e
 
COPY --from=kics-env /app /app
 
COPY ./entrypoint.sh /entrypoint.sh
 
RUN chmod +x /entrypoint.sh
 
COPY ./ /app
 
ENTRYPOINT ["/entrypoint.sh"]
