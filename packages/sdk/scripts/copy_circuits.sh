#!/bin/bash

CIRCUITS=("commitment" "withdraw")
DEST_DIR="./dist/node/artifacts"

mkdir -p "$DEST_DIR"
for circuit in "${CIRCUITS[@]}"
do
  cp "../circuits/trusted-setup/final-keys/$circuit.zkey" "$DEST_DIR/${circuit}.zkey"
  cp "../circuits/trusted-setup/final-keys/$circuit.vkey" "$DEST_DIR/${circuit}.vkey"
  cp "../circuits/build/$circuit/${circuit}_js/${circuit}.wasm" "$DEST_DIR/"
done
