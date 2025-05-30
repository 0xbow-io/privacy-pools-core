export const abi = [
  {
    "type": "function",
    "name": "assetConfig",
    "inputs": [
      {
        "name": "_asset",
        "type": "address",
        "internalType": "contract IERC20"
      }
    ],
    "outputs": [
      {
        "name": "_pool",
        "type": "address",
        "internalType": "contract IPrivacyPool"
      },
      {
        "name": "_minimumDepositAmount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_vettingFeeBPS",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_maxRelayFeeBPS",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "associationSets",
    "inputs": [
      {
        "name": "_index",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "_root",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_ipfsCID",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "_timestamp",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "deposit",
    "inputs": [
      {
        "name": "_asset",
        "type": "address",
        "internalType": "contract IERC20"
      },
      {
        "name": "_value",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_precommitment",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "_commitment",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "deposit",
    "inputs": [
      {
        "name": "_precommitment",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "_commitment",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "initialize",
    "inputs": [
      {
        "name": "_owner",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_postman",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "latestRoot",
    "inputs": [],
    "outputs": [
      {
        "name": "_root",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "registerPool",
    "inputs": [
      {
        "name": "_asset",
        "type": "address",
        "internalType": "contract IERC20"
      },
      {
        "name": "_pool",
        "type": "address",
        "internalType": "contract IPrivacyPool"
      },
      {
        "name": "_minimumDepositAmount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_vettingFeeBPS",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_maxRelayFeeBPS",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "relay",
    "inputs": [
      {
        "name": "_withdrawal",
        "type": "tuple",
        "internalType": "struct IPrivacyPool.Withdrawal",
        "components": [
          {
            "name": "processooor",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "data",
            "type": "bytes",
            "internalType": "bytes"
          }
        ]
      },
      {
        "name": "_proof",
        "type": "tuple",
        "internalType": "struct ProofLib.WithdrawProof",
        "components": [
          {
            "name": "pA",
            "type": "uint256[2]",
            "internalType": "uint256[2]"
          },
          {
            "name": "pB",
            "type": "uint256[2][2]",
            "internalType": "uint256[2][2]"
          },
          {
            "name": "pC",
            "type": "uint256[2]",
            "internalType": "uint256[2]"
          },
          {
            "name": "pubSignals",
            "type": "uint256[8]",
            "internalType": "uint256[8]"
          }
        ]
      },
      {
        "name": "_scope",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "removePool",
    "inputs": [
      {
        "name": "_asset",
        "type": "address",
        "internalType": "contract IERC20"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "rootByIndex",
    "inputs": [
      {
        "name": "_index",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "_root",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "scopeToPool",
    "inputs": [
      {
        "name": "_scope",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "_pool",
        "type": "address",
        "internalType": "contract IPrivacyPool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "updatePoolConfiguration",
    "inputs": [
      {
        "name": "_asset",
        "type": "address",
        "internalType": "contract IERC20"
      },
      {
        "name": "_minimumDepositAmount",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_vettingFeeBPS",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_maxRelayFeeBPS",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "updateRoot",
    "inputs": [
      {
        "name": "_root",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_ipfsCID",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [
      {
        "name": "_index",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "windDownPool",
    "inputs": [
      {
        "name": "_pool",
        "type": "address",
        "internalType": "contract IPrivacyPool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "withdrawFees",
    "inputs": [
      {
        "name": "_asset",
        "type": "address",
        "internalType": "contract IERC20"
      },
      {
        "name": "_recipient",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "Deposited",
    "inputs": [
      {
        "name": "_depositor",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "_pool",
        "type": "address",
        "indexed": true,
        "internalType": "contract IPrivacyPool"
      },
      {
        "name": "_commitment",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "_amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "FeesWithdrawn",
    "inputs": [
      {
        "name": "_asset",
        "type": "address",
        "indexed": false,
        "internalType": "contract IERC20"
      },
      {
        "name": "_recipient",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "_amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PoolConfigurationUpdated",
    "inputs": [
      {
        "name": "_pool",
        "type": "address",
        "indexed": false,
        "internalType": "contract IPrivacyPool"
      },
      {
        "name": "_asset",
        "type": "address",
        "indexed": false,
        "internalType": "contract IERC20"
      },
      {
        "name": "_newMinimumDepositAmount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "_newVettingFeeBPS",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "_newMaxRelayFeeBPS",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PoolRegistered",
    "inputs": [
      {
        "name": "_pool",
        "type": "address",
        "indexed": false,
        "internalType": "contract IPrivacyPool"
      },
      {
        "name": "_asset",
        "type": "address",
        "indexed": false,
        "internalType": "contract IERC20"
      },
      {
        "name": "_scope",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PoolRemoved",
    "inputs": [
      {
        "name": "_pool",
        "type": "address",
        "indexed": false,
        "internalType": "contract IPrivacyPool"
      },
      {
        "name": "_asset",
        "type": "address",
        "indexed": false,
        "internalType": "contract IERC20"
      },
      {
        "name": "_scope",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PoolWindDown",
    "inputs": [
      {
        "name": "_pool",
        "type": "address",
        "indexed": false,
        "internalType": "contract IPrivacyPool"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "RootUpdated",
    "inputs": [
      {
        "name": "_root",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "_ipfsCID",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      },
      {
        "name": "_timestamp",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "WithdrawalRelayed",
    "inputs": [
      {
        "name": "_relayer",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "_recipient",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "_asset",
        "type": "address",
        "indexed": true,
        "internalType": "contract IERC20"
      },
      {
        "name": "_amount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "_feeAmount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "AssetMismatch",
    "inputs": []
  },
  {
    "type": "error",
    "name": "AssetPoolAlreadyRegistered",
    "inputs": []
  },
  {
    "type": "error",
    "name": "EmptyRoot",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidEntrypointForPool",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidFeeBPS",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidIPFSCIDLength",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidIndex",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidPoolState",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidProcessooor",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidWithdrawalAmount",
    "inputs": []
  },
  {
    "type": "error",
    "name": "MinimumDepositAmount",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NativeAssetNotAccepted",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NativeAssetTransferFailed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NoRootsAvailable",
    "inputs": []
  },
  {
    "type": "error",
    "name": "PoolIsDead",
    "inputs": []
  },
  {
    "type": "error",
    "name": "PoolNotFound",
    "inputs": []
  },
  {
    "type": "error",
    "name": "RelayFeeGreaterThanMax",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ScopePoolAlreadyRegistered",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ZeroAddress",
    "inputs": []
  }
] as const;
