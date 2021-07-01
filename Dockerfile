FROM mhart/alpine-node:10.20.1

WORKDIR /usr/src/cognito-local

COPY . ./

RUN mkdir .cognito && npm i

ENV PATH /usr/src/cognito-local/node_modules/.bin:${PATH}

VOLUME /usr/src/cognito-local/.cognito

ENV HOST=0.0.0.0
EXPOSE 9229

CMD ["npm", "start"]
