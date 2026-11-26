/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agent from "../agent.js";
import type * as agentTools from "../agentTools.js";
import type * as ai from "../ai.js";
import type * as auth from "../auth.js";
import type * as bigquery from "../bigquery.js";
import type * as crons from "../crons.js";
import type * as crypto from "../crypto.js";
import type * as exportData from "../exportData.js";
import type * as http from "../http.js";
import type * as ingredients from "../ingredients.js";
import type * as lib from "../lib.js";
import type * as oauth from "../oauth.js";
import type * as recipes from "../recipes.js";
import type * as settings from "../settings.js";
import type * as suggestions from "../suggestions.js";
import type * as tokens from "../tokens.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agent: typeof agent;
  agentTools: typeof agentTools;
  ai: typeof ai;
  auth: typeof auth;
  bigquery: typeof bigquery;
  crons: typeof crons;
  crypto: typeof crypto;
  exportData: typeof exportData;
  http: typeof http;
  ingredients: typeof ingredients;
  lib: typeof lib;
  oauth: typeof oauth;
  recipes: typeof recipes;
  settings: typeof settings;
  suggestions: typeof suggestions;
  tokens: typeof tokens;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  auth: import("@convex-dev/auth/_generated/component.js").ComponentApi<"auth">;
  authGoogle: import("@convex-dev/auth/components/google/_generated/component.js").ComponentApi<"authGoogle">;
};
