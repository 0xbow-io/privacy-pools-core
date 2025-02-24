FROM node:23-bookworm

WORKDIR /build
RUN yarn global add typescript
RUN bash -c "curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh -s -- -y"
ENV PATH="/root/.cargo/bin:${PATH}"

RUN git clone https://github.com/iden3/circom.git
WORKDIR /build/circom
RUN cargo build --release
RUN cargo install --path circom
RUN cp /root/.cargo/bin/circom /usr/local/bin

WORKDIR /build/packages/relayer
# Copy package files
COPY packages/relayer/package.json packages/relayer/tsconfig.build.json ./
RUN yarn install

COPY packages/relayer/src/ ./src/
RUN yarn build


# Install root deps
WORKDIR /build
COPY package.json yarn.lock ./
RUN yarn install

# Install circuits deps

COPY packages/circuits /build/packages/circuits

WORKDIR /build/packages/circuits
RUN yarn install
RUN yarn compile
RUN yarn gencontract:withdraw
RUN yarn gencontract:commitment
RUN bash ./scripts/present.sh
RUN mkdir -p /build/packages/relayer/node_modules/@0xbow/privacy-pools-core-sdk/dist/node
RUN ln -s /build/packages/circuits/artifacts /build/packages/relayer/node_modules/@0xbow/privacy-pools-core-sdk/dist/node/artifacts

WORKDIR /build/packages/relayer

EXPOSE 3000
CMD ["node", "dist/src/index.js"]
