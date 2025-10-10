/**
 * @file src/core/service.js
 * @module core/service
 * @summary Compatibility shim that forwards to the modular service.
 *
 * This file used to contain the monolithic ResearchOpsService implementation.
 * After refactoring into feature modules under `src/service/`, we keep this
 * file as a stable import path and re-export the composed service.
 *
 * Keeping this shim avoids breaking any older imports like:
 *   import { ResearchOpsService } from "../core/service.js";
 */

export { ResearchOpsService } from "../service/index.js";
