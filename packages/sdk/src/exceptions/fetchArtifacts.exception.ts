export class FetchArtifact extends Error {
  constructor(artifact: URL) {
    const message = `Encountered error while loading artifact at ${artifact.toString()}.\nIf web, make sure assets are hosted from /artifacts.\nIf Node, make sure the assets were bundled correctly at dist/node/artifacts/`;
    super(message);
    this.name = "FetchArtifact";
  }
}
