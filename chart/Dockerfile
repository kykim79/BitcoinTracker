FROM node:6.12.0-slim

MAINTAINER KwonYoung Kim <kykim79@gmail.com>

RUN echo "Asia/Seoul" > /etc/timezone && dpkg-reconfigure -f noninteractive tzdata

RUN mkdir -p /app

COPY package.json /app/

RUN cd /app; npm install

WORKDIR /app

ADD . /app

VOLUME [ "/app/public/data" ]

CMD npm start
