export class CircuitInitialization extends Error {
  constructor(message: string) {
    super(`There was an error initializing the circuits: ${message}`);
    this.name = "CircuitInitialization";
  }
}
