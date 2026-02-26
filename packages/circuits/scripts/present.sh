#!/bin/bash

CIRCUITS=("commitment" "withdraw")
DEST_DIR="artifacts"

mkdir -p "$DEST_DIR"
for circuit in "${CIRCUITS[@]}"
do
  cp "trusted-setup/final-keys/$circuit.zkey" "$DEST_DIR/${circuit}.zkey"
  cp "trusted-setup/final-keys/$circuit.vkey" "$DEST_DIR/${circuit}.vkey"
  cp "build/$circuit/${circuit}_js/${circuit}.wasm" "$DEST_DIR/"
done
