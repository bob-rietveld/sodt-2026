/* eslint-disable */
/**
 * Generated `api` utility - stub file
 *
 * Run `npx convex dev` to generate the actual code
 */

import { makeFunctionReference } from "convex/server";

// Create stub function references that work with Convex React hooks
const createQueryRef = (path) => makeFunctionReference("query:" + path);
const createMutationRef = (path) => makeFunctionReference("mutation:" + path);

// This is a placeholder. Run `npx convex dev` to generate the actual API.
export const api = {
  pdfs: {
    list: createQueryRef("pdfs:list"),
    get: createQueryRef("pdfs:get"),
    getByDriveFileId: createQueryRef("pdfs:getByDriveFileId"),
    getFileUrl: createQueryRef("pdfs:getFileUrl"),
    search: createQueryRef("pdfs:search"),
    create: createMutationRef("pdfs:create"),
    update: createMutationRef("pdfs:update"),
    updateStatus: createMutationRef("pdfs:updateStatus"),
    approve: createMutationRef("pdfs:approve"),
    reject: createMutationRef("pdfs:reject"),
    remove: createMutationRef("pdfs:remove"),
  },
  processing: {
    createJob: createMutationRef("processing:createJob"),
    updateJob: createMutationRef("processing:updateJob"),
    getActiveJobs: createQueryRef("processing:getActiveJobs"),
    getFailedJobs: createQueryRef("processing:getFailedJobs"),
  },
  chat: {
    createSession: createMutationRef("chat:createSession"),
    addMessage: createMutationRef("chat:addMessage"),
    getSession: createQueryRef("chat:getSession"),
    listSessions: createQueryRef("chat:listSessions"),
  },
};

export const internal = {};
