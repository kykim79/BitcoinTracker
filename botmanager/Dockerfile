FROM node:6.12.0-alpine

MAINTAINER KwonYoung Kim <kykim79@gmail.com>

ENV TIMEZONE Asia/Seoul

RUN 	apk add --no-cache tzdata && \
	echo "${TIMEZONE}" > /etc/timezone && \
	ln -sf /usr/share/zoneinfo/${TIME_ZONE} /etc/localtime && \
	mkdir -p /app 

COPY package.json /app

RUN cd /app; npm install

WORKDIR /app 

ADD . /app

VOLUME [ "/app/config", "/app/log" ]

CMD node botManager.js
