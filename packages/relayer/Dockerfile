FROM node:23

WORKDIR /build
RUN yarn global add typescript

# Copy package files
COPY package.json tsconfig.build.json ./
RUN yarn install

COPY src/ ./src/
RUN yarn build

EXPOSE 3000
CMD ["node", "dist/index.js"]
