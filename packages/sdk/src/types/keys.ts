import { Secret } from "./commitment.js";

export interface MasterKeys {
  masterNullifier: Secret;
  masterSecret: Secret;
}
