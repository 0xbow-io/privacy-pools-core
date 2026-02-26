import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";

import path from "path";
import { CONFIG } from "../config/index.js";
import { RelayerDatabase } from "../types/db.types.js";
import {
  RequestStatus,
  WithdrawalPayload,
} from "../interfaces/relayer/request.js";

/**
 * Class representing an SQLite database for managing relayer requests.
 */
export class SqliteDatabase implements RelayerDatabase {
  /** Path to the SQLite database file. */
  readonly dbPath: string;

  /** Indicates whether the database has been initialized. */
  private _initialized: boolean = false;

  /** Database connection instance. */
  private db!: Database<sqlite3.Database, sqlite3.Statement>;

  /** SQL statement for creating the requests table. */
  private createTableRequest = `
CREATE TABLE IF NOT EXISTS requests (
    id UUID PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    request JSON,
    status TEXT CHECK(status IN ('BROADCASTED', 'FAILED', 'RECEIVED')) NOT NULL,
    txHash TEXT,
    error TEXT
);
`;

  /**
   * Initializes the database with the given path.
   */
  constructor() {
    this.dbPath = path.resolve(CONFIG.sqlite_db_path);
  }

  /**
   * Getter for the database initialization status.
   *
   * @returns {boolean} - Whether the database is initialized.
   */
  get initialized(): boolean {
    return this._initialized;
  }

  /**
   * Initializes the database connection and creates necessary tables.
   *
   * @returns {Promise<void>} - A promise that resolves when initialization is complete.
   */
  async init(): Promise<void> {
    try {
      this.db = await open({
        driver: sqlite3.Database,
        filename: this.dbPath,
      });
      await this.db.run(this.createTableRequest);
    } catch (error) {
      console.log(error);
    }
    this._initialized = true;
    console.log("sqlite db initialized");
  }

  /**
   * Inserts a new request record into the database.
   *
   * @param {string} requestId - Unique ID for the request.
   * @param {number} timestamp - Timestamp of the request.
   * @param {WithdrawalPayload} req - The withdrawal payload associated with the request.
   * @returns {Promise<void>} - A promise that resolves when the request is stored.
   */
  async createNewRequest(
    requestId: string,
    timestamp: number,
    req: WithdrawalPayload,
  ): Promise<void> {
    const strigifiedPayload = JSON.stringify(req, replacer);
    // Store initial request
    await this.db.run(
      `
      INSERT INTO requests (id, timestamp, request, status)
      VALUES (?, ?, ?, ?)
    `,
      [requestId, timestamp, strigifiedPayload, RequestStatus.RECEIVED],
    );
  }

  /**
   * Updates a request record with broadcast status and transaction hash.
   *
   * @param {string} requestId - The ID of the request.
   * @param {string} txHash - The transaction hash.
   * @returns {Promise<void>} - A promise that resolves when the update is complete.
   */
  async updateBroadcastedRequest(
    requestId: string,
    txHash: string,
  ): Promise<void> {
    // Update database
    await this.db.run(
      `
      UPDATE requests
      SET status = ?, txHash = ?
      WHERE id = ?
    `,
      [RequestStatus.BROADCASTED, txHash, requestId],
    );
  }

  /**
   * Updates a request record with failed status and error message.
   *
   * @param {string} requestId - The ID of the request.
   * @param {string} errorMessage - The error message.
   * @returns {Promise<void>} - A promise that resolves when the update is complete.
   */
  async updateFailedRequest(
    requestId: string,
    errorMessage: string,
  ): Promise<void> {
    // Update database with error
    await this.db.run(
      `
      UPDATE requests
      SET status = ?, error = ?
      WHERE id = ?
    `,
      [RequestStatus.FAILED, errorMessage, requestId],
    );
  }
}

/**
 * Custom JSON replacer function to handle BigInt serialization.
 *
 * @param {string} key - The JSON key.
 * @param {unknown} value - The JSON value.
 * @returns {unknown} - The transformed value.
 */
function replacer(key: string, value: unknown) {
  return typeof value === "bigint" ? { $bigint: value.toString() } : value;
}
