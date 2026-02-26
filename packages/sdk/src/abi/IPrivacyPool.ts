export const IPrivacyPoolABI = [
  {
    "type": "function",
    "name": "ASSET",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "ENTRYPOINT",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IEntrypoint"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "MAX_TREE_DEPTH",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "RAGEQUIT_VERIFIER",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IVerifier"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "ROOT_HISTORY_SIZE",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "SCOPE",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "WITHDRAWAL_VERIFIER",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IVerifier"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "currentRoot",
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
    "name": "currentRootIndex",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint32",
        "internalType": "uint32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "currentTreeDepth",
    "inputs": [],
    "outputs": [
      {
        "name": "_depth",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "currentTreeSize",
    "inputs": [],
    "outputs": [
      {
        "name": "_size",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "dead",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "deposit",
    "inputs": [
      {
        "name": "_depositor",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_value",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "_precommitmentHash",
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
    "name": "depositors",
    "inputs": [
      {
        "name": "_label",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "_depositooor",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "nonce",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "nullifierHashes",
    "inputs": [
      {
        "name": "_nullifierHash",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "_spent",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "ragequit",
    "inputs": [
      {
        "name": "_proof",
        "type": "tuple",
        "internalType": "struct ProofLib.RagequitProof",
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
            "type": "uint256[4]",
            "internalType": "uint256[4]"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "roots",
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
    "name": "windDown",
    "inputs": [],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "withdraw",
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
        "name": "_commitment",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "_label",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "_value",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "_precommitmentHash",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "LeafInserted",
    "inputs": [
      {
        "name": "_index",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "_leaf",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "_root",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PoolDied",
    "inputs": [],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Ragequit",
    "inputs": [
      {
        "name": "_ragequitter",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "_commitment",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "_label",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "_value",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Withdrawn",
    "inputs": [
      {
        "name": "_processooor",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "_value",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "_spentNullifier",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "_newCommitment",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "ContextMismatch",
    "inputs": []
  },
  {
    "type": "error",
    "name": "IncorrectASPRoot",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidCommitment",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidDepositValue",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidProcessooor",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidProof",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidTreeDepth",
    "inputs": []
  },
  {
    "type": "error",
    "name": "LeafAlreadyExists",
    "inputs": []
  },
  {
    "type": "error",
    "name": "LeafCannotBeZero",
    "inputs": []
  },
  {
    "type": "error",
    "name": "LeafGreaterThanSnarkScalarField",
    "inputs": []
  },
  {
    "type": "error",
    "name": "MaxTreeDepthReached",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotYetRagequitteable",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NullifierAlreadySpent",
    "inputs": []
  },
  {
    "type": "error",
    "name": "OnlyEntrypoint",
    "inputs": []
  },
  {
    "type": "error",
    "name": "OnlyOriginalDepositor",
    "inputs": []
  },
  {
    "type": "error",
    "name": "PoolIsDead",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ScopeMismatch",
    "inputs": []
  },
  {
    "type": "error",
    "name": "UnknownStateRoot",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ZeroAddress",
    "inputs": []
  }
];
