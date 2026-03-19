#!/bin/bash
set -euo pipefail

source .env

ACCOUNT="${ACCOUNT:?ACCOUNT env var is required}"
DEPLOYER=$(cast wallet address --account "$ACCOUNT")

if [ -z "${ETHERSCAN_API_KEY:-}" ]; then
  echo "ERROR: ETHERSCAN_API_KEY is not set"
  exit 1
fi

CHAIN_NAMES=("ethereum" "optimism" "arbitrum-one" "bsc")
CHAIN_RPCS=("$ETHEREUM_MAINNET_RPC" "$OP_MAINNET_RPC" "$ARBITRUM_ONE_RPC" "$BSC_RPC")

echo "Deployer: $DEPLOYER"
echo ""

# Verify nonce is 0 on all chains before deploying
for i in "${!CHAIN_NAMES[@]}"; do
  nonce=$(cast nonce "$DEPLOYER" --rpc-url "${CHAIN_RPCS[$i]}")
  echo "${CHAIN_NAMES[$i]}: nonce=$nonce"
  if [ "$nonce" != "0" ]; then
    echo "ERROR: nonce on ${CHAIN_NAMES[$i]} is $nonce, expected 0"
    exit 1
  fi
done

echo ""
echo "All nonces are 0. Deploying Multicall3..."
echo ""

for i in "${!CHAIN_NAMES[@]}"; do
  echo "=== ${CHAIN_NAMES[$i]} ==="
  forge create src/contracts/lib/Multicall3.sol:Multicall3 \
    --account "$ACCOUNT" \
    --rpc-url "${CHAIN_RPCS[$i]}" \
    --verify \
    "$@"
  echo ""
done

echo "Multicall3 deployed on all chains!"
