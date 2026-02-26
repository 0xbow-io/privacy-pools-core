import { describe, it, expect, beforeEach } from "vitest";
import { poseidon } from "maci-crypto/build/ts/hashing.js";
import { CommitmentPreimage, Hash, Precommitment, Secret } from "../../src/types/commitment.js";
import { BruteForceRecoveryService } from "../../src/core/bruteForce.service.js";

describe("BruteForceRecoveryService - Brute Force Recovery", () => {
    let service: BruteForceRecoveryService;

    beforeEach(() => {
        service = new BruteForceRecoveryService();
    });

    it("should find a matching commitment", async () => {
        const precommitment: Precommitment = { hash: BigInt(12345) as Hash, nullifier: BigInt(67890) as Secret, secret: BigInt(11111) as Secret };
        const label = BigInt(42);
        const min = 1;
        const max = 5;
        const step = 1;

        const testCommitmentPreimage: CommitmentPreimage = { value: BigInt(3), label, precommitment };
        const expectedHash = poseidon([testCommitmentPreimage.value, label, precommitment.hash]) as Hash;

        const params = {
            commitmentHash: expectedHash,
            valueRange: { min, max, step },
            basePrecommitment: precommitment,
            label,
            options: { timeout: 5000 },
        };

        const result = await service.bruteForceRecoverCommitment(params);

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data?.[0]?.commitment.hash).toBe(expectedHash);
    });

    it("should return NOT_FOUND when no matching commitment is found", async () => {
        const precommitment: Precommitment = { hash: BigInt(54321) as Hash, nullifier: BigInt(98765) as Secret, secret: BigInt(22222) as Secret };
        const label = BigInt(42);
        const min = 1;
        const max = 5;
        const step = 1;
        const expectedHash: Hash = BigInt(99999) as Hash;

        const params = {
            commitmentHash: expectedHash,
            valueRange: { min, max, step },
            basePrecommitment: precommitment,
            label,
            options: { timeout: 3000 },
        };

        const result = await service.bruteForceRecoverCommitment(params);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe("NOT_FOUND");
    });

    it("should find a real matching commitment with actual Poseidon hash", async () => {
        const precommitment: Precommitment = { hash: BigInt(987654321) as Hash, nullifier: BigInt(123456789) as Secret, secret: BigInt(111222333) as Secret };
        const label = BigInt(99);
        const min = 1000;
        const max = 1005;
        const step = 1;

        const realValue = 1003;
        const testCommitmentPreimage: CommitmentPreimage = { value: BigInt(realValue), label, precommitment };
        const expectedHash = poseidon([testCommitmentPreimage.value, label, precommitment.hash]) as Hash;

        const params = {
            commitmentHash: expectedHash,
            valueRange: { min, max, step },
            basePrecommitment: precommitment,
            label,
            options: { timeout: 5000 },
        };

        const result = await service.bruteForceRecoverCommitment(params);

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data?.[0]?.commitment.hash).toBe(expectedHash);
        expect(result.data?.[0]?.value).toBe(realValue);
    });

    it("should correctly handle decimal values inferred from step size", async () => {
        const precommitment: Precommitment = { hash: BigInt(654321) as Hash, nullifier: BigInt(123456) as Secret, secret: BigInt(98765) as Secret };
        const label = BigInt(99);
        const min = 0.00001;
        const max = 0.00010;
        const step = 0.00001;

        const realValue = 0.00005;
        const scaledValue = BigInt(realValue * 10 ** service["getDecimalPlaces"](step));

        const testCommitmentPreimage: CommitmentPreimage = { value: scaledValue, label, precommitment };
        const expectedHash = poseidon([testCommitmentPreimage.value, label, precommitment.hash]) as Hash;

        const params = {
            commitmentHash: expectedHash,
            valueRange: { min, max, step },
            basePrecommitment: precommitment,
            label,
            options: { timeout: 5000 },
        };

        const result = await service.bruteForceRecoverCommitment(params);

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data?.[0]?.commitment.hash).toBe(expectedHash);
        expect(result.data?.[0]?.value).toBe(realValue);
    });
});
