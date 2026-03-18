# Properties and invariants

> ⚠️ **Warning**: This document is a work in progress and may be incomplete or contain inaccuracies. Please review carefully and report any issues.
These properties are focused mostly on the protocol accounting, as the constraints around
commitment and all inputs are handled by the circuits.


## General

We include non-reversion invariants for deposit/withdraw/ragequit

| Id    | Properties                                                                                                                 |
| ----- | -------------------------------------------------------------------------------------------------------------------------- |
| 1     | No free withdrawals (an address can only withdraw up to an amount that it has deposited or has control over)                     |
| 2     | No double spending (a nullifier can only be spent once)                                                                    |
| 3     | Only original depositor can ragequit their deposit                                                                         |
| 4     | Shutdown: protocol unwind and full withdrawals leaves no fund in entrypoint and pool contracts                             |
| 5     | Pool merkle tree should contains both deposit and withdraw commits                                                         |
| 6     | Ragequit shouldn't modify the pool root                                                                                    |
| ACC-1 | token balance == net deposit + vetting fee not withdrawn (balance sheet equilibrium)        |
| ACC-2 | cash flow in == token balance - sum of fees and deposits withdrawals (no unaccounted deposits)                                             |
| ACC-3 | cash flow out == total net withdrawals out + total vetting fee out + total processing fee out (no unaccounted withdrawals) |
| ACC-4 | Entrypoint balance == total vetting fee out                                                                                |
| ACC-5 | processoor balance == total processing fee out                                                                             |

### Poseidon hash equivalence

There are 2 different implementations of the Poseidon hash function in the codebase, in PrivacyPool and in the IMT library. They are using respectively 2 and 3 elements arrays.
We compare both against the Iden3 implementation (which support arbitrary array length), by direct output comparison (using Medusa).
To replicate Iden3's implementation, run the script in test/invariants/fuzz/external/generate_id3_poseidon_output.js.

The `ACC` invariants are based on the following accounting:

### Balance sheet

| Assets        | Liabilities                  |
| ------------- | ---------------------------- |
| token balance | net deposit non-withdrawn    |
|               | vetting fee non withdrawn    |

### Accounting operations & writings

We take some writing shortcuts (sorry accountant friends), as some intermediate writings would not be reflected in our tests anyway and for clarity purposes:
- deposit:
-- decrease: sender balance 
-- increase: token balance (+ ghost: total token in), net deposit non-withdrawn, vetting fee non withdrawn (vetting)

- withdraw:
-- decrease: net deposit non-withdrawn, token balance
-- increase: sender balance (+ ghost: total net withdrawals out) - processing fee is directly sent to the processor address

- vetting fee withdrawal:
-- decrease: fee non withdrawn, token balance
-- increase: entry point balance (+ ghost: total fee out)