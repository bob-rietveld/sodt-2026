/* eslint-disable */
/**
 * Generated server utilities - stub file
 *
 * Run `npx convex dev` to generate the actual types
 */

import type {
  queryGeneric,
  mutationGeneric,
  actionGeneric,
  internalQueryGeneric,
  internalMutationGeneric,
  internalActionGeneric,
  httpActionGeneric,
  QueryCtx as GenericQueryCtx,
  MutationCtx as GenericMutationCtx,
  ActionCtx as GenericActionCtx,
} from "convex/server";
import type { DataModel } from "./dataModel";

export declare const query: typeof queryGeneric;
export declare const mutation: typeof mutationGeneric;
export declare const action: typeof actionGeneric;
export declare const internalQuery: typeof internalQueryGeneric;
export declare const internalMutation: typeof internalMutationGeneric;
export declare const internalAction: typeof internalActionGeneric;
export declare const httpAction: typeof httpActionGeneric;

export type QueryCtx = GenericQueryCtx<DataModel>;
export type MutationCtx = GenericMutationCtx<DataModel>;
export type ActionCtx = GenericActionCtx<DataModel>;
