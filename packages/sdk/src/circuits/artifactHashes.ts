import { CircuitName, CircuitNameString } from "./circuits.interface.js";

type ArtifactType = "wasm" | "vkey" | "zkey";

/**
 * Expected SHA-256 hex digests for every downloaded circuit artifact.
 *
 * vkey and zkey hashes are derived from the trusted-setup ceremony outputs
 * committed in packages/circuits/trusted-setup/final-keys/.
 *
 * wasm hashes are derived from the compiled circuit outputs
 * in packages/circuits/build/.
 *
 * Every artifact downloaded by the SDK MUST have a hash entry here.
 * verifyArtifactIntegrity throws if a hash is missing — refusing to
 * load unverified artifacts is the correct security posture.
 */
export const ARTIFACT_HASHES: Record<
  CircuitNameString,
  Partial<Record<ArtifactType, string>>
> = {
  [CircuitName.Commitment]: {
    wasm: "254d2130607182fd6fd1aee67971526b13cfe178c88e360da96dce92663828d8",
    vkey: "7d48b4eb3dedc12fb774348287b587f0c18c3c7254cd60e9cf0f8b3636a570d8",
    zkey: "494ae92d64098fda2a5649690ddc5821fcd7449ca5fe8ef99ee7447544d7e1f3",
  },
  [CircuitName.Withdraw]: {
    wasm: "36cda22791def3d520a55c0fc808369cd5849532a75fab65686e666ed3d55c10",
    vkey: "666bd0983b20c1611543b04f7712e067fbe8cad69f07ada8a310837ff398d21e",
    zkey: "2a893b42174c813566e5c40c715a8b90cd49fc4ecf384e3a6024158c3d6de677",
  },
  [CircuitName.MerkleTree]: {},
};

// Freeze the manifest so runtime code cannot swap out trusted hashes.
for (const circuitHashes of Object.values(ARTIFACT_HASHES)) {
  if (circuitHashes != null) {
    Object.freeze(circuitHashes);
  }
}

Object.freeze(ARTIFACT_HASHES);

export async function sha256Hex(data: Uint8Array): Promise<string> {
  const hashBuffer = await globalThis.crypto.subtle.digest(
    "SHA-256",
    data as ArrayBufferView<ArrayBuffer>,
  );
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyArtifactIntegrity(
  circuitName: CircuitNameString,
  artifactType: ArtifactType,
  data: Uint8Array,
): Promise<void> {
  const expectedHash = ARTIFACT_HASHES[circuitName]?.[artifactType];
  if (expectedHash === undefined) {
    throw new Error(
      `No integrity hash registered for ${circuitName}.${artifactType}. ` +
        `Refusing to load unverified artifact.`,
    );
  }

  const actualHash = await sha256Hex(data);
  if (actualHash !== expectedHash) {
    throw new Error(
      `Integrity check failed for ${circuitName}.${artifactType}: ` +
        `expected ${expectedHash}, got ${actualHash}`,
    );
  }
}
