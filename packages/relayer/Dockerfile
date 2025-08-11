FROM node:23
ARG GIT_SHA="0000000"
ARG BUILD_DATE=

WORKDIR /build
RUN yarn global add typescript

# Copy package files
COPY package.json tsconfig.build.json ./
RUN yarn install

COPY src/ ./src/
RUN yarn build
ENV GIT_SHA=$GIT_SHA
ENV BUILD_DATE=$BUILD_DATE

EXPOSE 3000
CMD ["node", "dist/index.js"]
