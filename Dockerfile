FROM ubuntu:18.04

RUN  apt-get update && \ 
     apt-get install -y wget curl

COPY entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]