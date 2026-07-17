import { BridgeEventRoute } from "./bridge_event_route.mjs";
import { ADD_COMMAND, REMOVE_COMMAND } from "./official_java_transport.mjs";

export class CompanionBridgeSession {
  constructor({ transport, credential, worktreeId, callbackId, onClasspathEvent }) {
    if (typeof transport?.executeBridgeCommand !== "function") {
      throw new Error("official Java transport is required");
    }
    this.transport = transport;
    this.route = new BridgeEventRoute({
      credential,
      worktreeId,
      callbackId,
      onEvent: onClasspathEvent,
    });
    this.identity = { credential, worktreeId, callbackId };
    this.registration = undefined;
    this.state = "idle";
  }

  async start() {
    if (this.state !== "idle") {
      throw new Error("companion bridge session is not idle");
    }
    this.state = "starting";
    let endpoint;
    try {
      endpoint = await this.route.start();
      this.registration = Object.freeze({
        schemaVersion: 1,
        callbackId: this.identity.callbackId,
        endpoint,
        credential: this.identity.credential,
        worktreeId: this.identity.worktreeId,
        batched: false,
      });
      const result = await this.transport.executeBridgeCommand(
        ADD_COMMAND,
        this.registration,
      );
      if (result !== "ok") {
        throw new Error("bridge registration returned an unexpected result");
      }
      this.state = "running";
    } catch (error) {
      let cleanupFailed = false;
      if (this.registration !== undefined) {
        try {
          const cleanupResult = await this.transport.executeBridgeCommand(
            REMOVE_COMMAND,
            this.registration,
          );
          cleanupFailed = cleanupResult !== "ok";
        } catch {
          cleanupFailed = true;
        }
      }
      if (endpoint !== undefined) {
        await this.route.close();
      }
      if (cleanupFailed) {
        this.state = "remove-failed";
        throw new Error("bridge registration cleanup did not complete");
      }
      this.registration = undefined;
      this.state = "idle";
      throw error;
    }
  }

  async close() {
    if (this.state === "idle") {
      return;
    }
    if (
      !["running", "remove-failed"].includes(this.state) ||
      this.registration === undefined
    ) {
      throw new Error("companion bridge session cannot close in its current state");
    }
    this.state = "closing";
    const registration = this.registration;
    let removalSucceeded = false;
    try {
      const result = await this.transport.executeBridgeCommand(
        REMOVE_COMMAND,
        registration,
      );
      if (result !== "ok") {
        throw new Error("bridge removal returned an unexpected result");
      }
      removalSucceeded = true;
    } finally {
      try {
        await this.route.close();
      } finally {
        if (removalSucceeded) {
          this.registration = undefined;
          this.state = "idle";
        } else {
          this.state = "remove-failed";
        }
      }
    }
  }
}
