export class InvalidRpcUrl extends Error {
  constructor(url: string) {
    super(`${url} is invalid`);
    this.name = "InvalidRpcUrl";
  }
}
