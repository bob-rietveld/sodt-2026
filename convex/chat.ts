import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Create a new chat session
export const createSession = mutation({
  handler: async (ctx) => {
    return await ctx.db.insert("chatSessions", {
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// Get a chat session
export const getSession = query({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sessionId);
  },
});

// Add a message to a session
export const addMessage = mutation({
  args: {
    sessionId: v.id("chatSessions"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    sources: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");

    const newMessage = {
      role: args.role,
      content: args.content,
      sources: args.sources,
      timestamp: Date.now(),
    };

    await ctx.db.patch(args.sessionId, {
      messages: [...session.messages, newMessage],
      updatedAt: Date.now(),
    });
  },
});

// Delete a chat session
export const deleteSession = mutation({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.sessionId);
  },
});
