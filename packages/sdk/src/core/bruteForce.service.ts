import { poseidon } from "maci-crypto/build/ts/hashing.js";
import { Commitment, CommitmentPreimage, Hash, Precommitment } from "../types/commitment.js";

/**
 * Parameters required for brute-force commitment recovery.
 */
interface BruteForceRecoveryParams {
  /** The target commitment hash to match against */
  commitmentHash: Hash;

  /** Defines the range of values to search within */
  valueRange: {
    min: number;
    max: number;
    step: number;
  };

  /** The precommitment object containing the hash, nullifier, and secret */
  basePrecommitment: Precommitment;

  /** The label used during commitment computation */
  label: bigint;

  /** Optional settings: timeout in milliseconds */
  options?: {
    timeout?: number;
  };
}

/**
 * The result of the brute-force commitment recovery process.
 */
interface RecoveryResult {
  /** Indicates whether the recovery was successful */
  success: boolean;

  /** Contains the found commitment and its value if successful */
  data?: Array<{ commitment: Commitment; value: number }>;

  /** Contains an error code and message if the recovery fails */
  error?: { code: string; message: string };
}

/**
 * Service for brute-force recovering commitments by iterating over possible values.
 * This method is useful when the original commitment value is lost, but the precommitment and hash are known.
 */
export class BruteForceRecoveryService {
  /**
   * Attempts to recover a commitment by brute-forcing through the given value range.
   *
   * @param params - The parameters required for the brute-force search.
   * @returns A `Promise` resolving to a `RecoveryResult` containing either the found commitment or an error.
   */
  public async bruteForceRecoverCommitment(params: BruteForceRecoveryParams): Promise<RecoveryResult> {
    const { commitmentHash, valueRange, basePrecommitment, label, options } = params;
    const { min, max, step } = valueRange;
    const timeout = options?.timeout ?? 30_000;

    // infer asset decimals from step size
    const assetDecimals = this.getDecimalPlaces(step);
    const scaleFactor = BigInt(10 ** assetDecimals);

    // input range to integer space
    const minInt = BigInt(Math.round(min * Number(scaleFactor)));
    const maxInt = BigInt(Math.round(max * Number(scaleFactor)));
    const stepInt = BigInt(Math.round(step * Number(scaleFactor)));

    // brute-force search promise
    const bruteForcePromise = new Promise<RecoveryResult>((resolve) => {
      for (let value = minInt; value <= maxInt; value += stepInt) {
        const computedHash = this.computeCommitmentHash({
          value,
          label,
          precommitment: basePrecommitment,
        });

        if (computedHash === commitmentHash) {
          const decimalValue = Number(value) / Number(scaleFactor);
          const preimage: CommitmentPreimage = { value, label, precommitment: basePrecommitment };
          const commitment: Commitment = {
            hash: computedHash,
            nullifierHash: basePrecommitment.hash,
            preimage,
          };

          resolve({ success: true, data: [{ commitment, value: decimalValue }] });
          return;
        }
      }

      resolve({ success: false, error: { code: "NOT_FOUND", message: "No matching commitment found." } });
    });

    // timeout promise
    const timeoutPromise = new Promise<RecoveryResult>((resolve) => {
      setTimeout(() => resolve({ success: false, error: { code: "TIMEOUT", message: "Brute-force recovery timed out." } }), timeout);
    });

    // return the first resolved promise
    return Promise.race([bruteForcePromise, timeoutPromise]);
  }

  /**
   * Computes the Poseidon hash of a commitment.
   */
  private computeCommitmentHash(preimage: CommitmentPreimage): Hash {
    return poseidon([preimage.value, preimage.label, preimage.precommitment.hash]) as Hash;
  }

  /**
   * Determines the number of decimal places in a given number.
   */
  private getDecimalPlaces(num: number): number {
    if (!Number.isFinite(num)) return 0;
    const str = num.toString();
    const decimalPart = str.split(".")[1];
    return decimalPart ? decimalPart.length : 0;
  }
}
