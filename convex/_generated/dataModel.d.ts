/* eslint-disable */
/**
 * Generated data model types - stub file
 *
 * Run `npx convex dev` to generate the actual types
 */

import type { DataModelFromSchemaDefinition } from "convex/server";
import type schema from "../schema";

export type DataModel = DataModelFromSchemaDefinition<typeof schema>;

export type Id<TableName extends keyof DataModel> = string & {
  __tableName: TableName;
};

export type Doc<TableName extends keyof DataModel> = DataModel[TableName]["document"];
