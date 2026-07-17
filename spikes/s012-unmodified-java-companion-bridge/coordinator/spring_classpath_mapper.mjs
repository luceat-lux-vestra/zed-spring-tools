import { CompanionBridgeSession } from "./companion_bridge_session.mjs";

export const SPRING_ADD_METHOD = "sts/addClasspathListener";
export const SPRING_REMOVE_METHOD = "sts/removeClasspathListener";

export class SpringClasspathMapper {
  constructor({ transport, credential, worktreeId, executeSpringCommand }) {
    if (typeof executeSpringCommand !== "function") {
      throw new Error("Spring command executor is required");
    }
    this.transport = transport;
    this.credential = credential;
    this.worktreeId = worktreeId;
    this.executeSpringCommand = executeSpringCommand;
    this.session = undefined;
    this.callbackId = undefined;
  }

  async handleRequest(method, params) {
    switch (method) {
      case SPRING_ADD_METHOD:
        return await this.#add(params);
      case SPRING_REMOVE_METHOD:
        return await this.#remove(params);
      default:
        throw new Error("unsupported Spring classpath method");
    }
  }

  async close() {
    const session = this.session;
    if (session !== undefined) {
      await session.close();
      this.session = undefined;
      this.callbackId = undefined;
    }
  }

  async #add(params) {
    if (
      !hasExactKeys(params, ["batched", "callbackCommandId"]) ||
      params.batched !== true ||
      !/^[A-Za-z0-9._-]{1,128}$/.test(params.callbackCommandId ?? "") ||
      this.session !== undefined
    ) {
      throw new Error("Spring classpath add request is invalid");
    }
    const callbackId = params.callbackCommandId;
    const session = new CompanionBridgeSession({
      transport: this.transport,
      credential: this.credential,
      worktreeId: this.worktreeId,
      callbackId,
      onClasspathEvent: async (arguments_) =>
        await this.executeSpringCommand({
          command: callbackId,
          arguments: structuredClone(arguments_),
        }),
    });
    try {
      await session.start();
      this.session = session;
      this.callbackId = callbackId;
      return "ok";
    } catch (error) {
      await session.close();
      throw error;
    }
  }

  async #remove(params) {
    if (
      !hasExactKeys(params, ["callbackCommandId"]) ||
      params.callbackCommandId !== this.callbackId ||
      this.session === undefined
    ) {
      throw new Error("Spring classpath remove request is invalid");
    }
    const session = this.session;
    await session.close();
    this.session = undefined;
    this.callbackId = undefined;
    return "ok";
  }
}

function hasExactKeys(value, expected) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const actual = Object.keys(value).sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}
