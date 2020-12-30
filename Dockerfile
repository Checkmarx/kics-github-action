FROM ubuntu:18.04

RUN  apt-get update 
RUN  apt-get install -y wget
RUN  apt-get install -y curl

COPY entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]