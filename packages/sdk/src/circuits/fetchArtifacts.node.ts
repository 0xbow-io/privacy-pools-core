import { FetchArtifact } from "../exceptions/fetchArtifacts.exception.js";

export async function fetchVersionedArtifact(
  artifactUrl: URL,
): Promise<Uint8Array> {
  try {
    const fs = (await import("fs")).default;
    const readPromise: Promise<Buffer> = new Promise((resolve, reject) => {
      fs.readFile(artifactUrl.pathname, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
    const buf = await readPromise;
    return new Uint8Array(buf);
  } catch (error) {
    console.error(error);
    throw new FetchArtifact(artifactUrl);
  }
}
