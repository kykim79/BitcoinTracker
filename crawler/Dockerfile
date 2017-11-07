FROM node:6.2.2

MAINTAINER KwonYoung Kim <kykim79@gmail.com>

RUN echo "Asia/Seoul" > /etc/timezone && dpkg-reconfigure -f noninteractive tzdata

RUN mkdir -p /app

COPY package.json /app

RUN cd /app; npm install

WORKDIR /app

ADD . /app

RUN mkdir -p /app/config

VOLUME [ "/app/config", "/app/log" ]

CMD node crawler.js
