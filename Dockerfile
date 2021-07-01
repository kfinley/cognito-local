FROM mhart/alpine-node:10.20.1

RUN mkdir -p /cognito-local
WORKDIR /cognito-local

# Install app dependencies
COPY [ "package.json", "babel.config.js", "tsconfig.json", "tsconfig.build.json",  "/cognito-local/" ]

RUN npm i

RUN mkdir -p /src

VOLUME /cognito-local/.cognito
VOLUME /cognito-local/src/

ENV HOST=0.0.0.0
EXPOSE 9229

CMD ["npm", "start"]
