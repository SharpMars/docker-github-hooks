FROM oven/bun
WORKDIR /usr/src/app

COPY index.ts index.ts
COPY package.json package.json

RUN "bun i"

EXPOSE 3000

ENTRYPOINT [ "bun", "run", "index.ts" ]