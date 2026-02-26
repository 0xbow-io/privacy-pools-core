import { FetchArtifact } from "../exceptions/fetchArtifacts.exception.js";

export async function fetchVersionedArtifact(
  artifactUrl: URL,
): Promise<Uint8Array> {
  const res = await fetch(artifactUrl);
  if (res.status !== 200) {
    throw new FetchArtifact(artifactUrl);
  }
  const aBuf = await res.arrayBuffer();
  return new Uint8Array(aBuf);
}
