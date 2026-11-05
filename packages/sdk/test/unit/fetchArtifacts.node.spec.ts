import { mkdtemp, readFile, rmdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { fetchVersionedArtifact } from "../../src/circuits/fetchArtifacts.node.js";

describe("Node artifact file URLs", () => {
  let artifactDirectory: string | undefined;
  let artifactPath: string | undefined;

  afterEach(async () => {
    if (artifactPath) {
      await unlink(artifactPath);
      artifactPath = undefined;
    }
    if (artifactDirectory) {
      await rmdir(artifactDirectory);
      artifactDirectory = undefined;
    }
  });

  it.each([
    ["plain paths", "privacy-pools-"],
    ["spaces", "privacy pools "],
    ["hash characters", "privacy-pools-#-"],
    ["percent characters", "privacy-pools-%-"],
    ["Unicode characters", "privacy-pools-é-字-"],
  ])("loads exact artifact bytes from %s", async (_name, prefix) => {
    artifactDirectory = await mkdtemp(join(tmpdir(), prefix));
    artifactPath = join(artifactDirectory, "withdraw.wasm");
    const bytes = new Uint8Array([0, 1, 127, 128, 255]);
    await writeFile(artifactPath, bytes);

    const artifactUrl = pathToFileURL(artifactPath);

    // Verify the fixture through Node's file URL support before testing the loader.
    expect(new Uint8Array(await readFile(artifactUrl))).toEqual(bytes);
    await expect(fetchVersionedArtifact(artifactUrl)).resolves.toEqual(bytes);
  });
});
