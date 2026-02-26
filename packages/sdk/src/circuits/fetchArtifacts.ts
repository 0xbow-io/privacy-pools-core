export async function importFetchVersionedArtifact(isBrowser: boolean) {
  if (isBrowser) {
    return import(`./fetchArtifacts.esm.js`);
  } else {
    return import(`./fetchArtifacts.node.js`);
  }
}
