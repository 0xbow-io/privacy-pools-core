#!/usr/bin/env node
import {
  PrivacyPoolSDK,
  Circuits,
} from "@0xbow/privacy-pools-core-sdk";
import { encodeAbiParameters } from "viem";

// Function to temporarily redirect stdout
function withSilentStdout(fn) {
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;

  return async (...args) => {
    // Temporarily disable stdout/stderr
    process.stdout.write = () => true;
    process.stderr.write = () => true;

    try {
      const result = await fn(...args);
      // Restore stdout/stderr
      process.stdout.write = originalStdoutWrite;
      process.stderr.write = originalStderrWrite;
      return result;
    } catch (error) {
      // Restore stdout/stderr
      process.stdout.write = originalStdoutWrite;
      process.stderr.write = originalStderrWrite;
      throw error;
    }
  };
}

async function main() {
  const [value, label, nullifier, secret] = process.argv.slice(2).map(BigInt);

  try {
    const circuits = new Circuits();
    const privacyPoolSDK = new PrivacyPoolSDK(circuits);

    // Wrap the proveCommitment call with stdout redirection
    const silentProveCommitment = withSilentStdout(
      privacyPoolSDK.proveCommitment.bind(privacyPoolSDK),
    );

    const { proof, publicSignals } = await silentProveCommitment(
      value,
      label,
      nullifier,
      secret,
    );

    const ragequitProof = {
      _pA: [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])],
      _pB: [
        [BigInt(proof.pi_b[0][1]), BigInt(proof.pi_b[0][0])],
        [BigInt(proof.pi_b[1][1]), BigInt(proof.pi_b[1][0])],
      ],
      _pC: [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])],
      _pubSignals: [
        publicSignals[0], // commitment hash
        publicSignals[1], // precommitment hash
        publicSignals[2], // nullifier hash
        publicSignals[3], // value
        publicSignals[4], // label
      ].map((x) => BigInt(x)),
    };

    const encodedProof = encodeAbiParameters(
      [
        {
          type: "tuple",
          components: [
            { name: "_pA", type: "uint256[2]" },
            { name: "_pB", type: "uint256[2][2]" },
            { name: "_pC", type: "uint256[2]" },
            { name: "_pubSignals", type: "uint256[5]" },
          ],
        },
      ],
      [ragequitProof],
    );

    process.stdout.write(encodedProof);
    process.exit(0);
  } catch {
    // Exit silently on any error
    process.exit(1);
  }
}

// Catch any uncaught errors and exit silently
main().catch(() => process.exit(1));
