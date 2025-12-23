import { query, mutation } from "./_generated/server"
import { v } from "convex/values"

// Store an elevation tile
export const storeTile = mutation({
  args: {
    lat: v.number(),
    lng: v.number(),
    fileId: v.id("_storage"),
    size: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if tile already exists
    const existing = await ctx.db
      .query("elevationTiles")
      .withIndex("by_lat_lng", (q) => q.eq("lat", args.lat).eq("lng", args.lng))
      .first()

    if (existing) {
      // Update existing tile
      await ctx.db.patch(existing._id, {
        fileId: args.fileId,
        size: args.size,
        uploadedAt: Date.now(),
      })
      return existing._id
    } else {
      // Create new tile record
      return await ctx.db.insert("elevationTiles", {
        lat: args.lat,
        lng: args.lng,
        fileId: args.fileId,
        size: args.size,
        uploadedAt: Date.now(),
      })
    }
  },
})

// Get elevation tile file URL
export const getTile = query({
  args: {
    lat: v.number(),
    lng: v.number(),
  },
  handler: async (ctx, args) => {
    const tile = await ctx.db
      .query("elevationTiles")
      .withIndex("by_lat_lng", (q) => q.eq("lat", args.lat).eq("lng", args.lng))
      .first()

    if (!tile) {
      return null
    }

    // Get file URL from Convex storage
    const url = await ctx.storage.getUrl(tile.fileId)
    return {
      url,
      lat: tile.lat,
      lng: tile.lng,
      size: tile.size,
    }
  },
})

// Get tiles in a bounding box
export const getTiles = query({
  args: {
    minLat: v.number(),
    maxLat: v.number(),
    minLng: v.number(),
    maxLng: v.number(),
  },
  handler: async (ctx, args) => {
    const tiles = await ctx.db
      .query("elevationTiles")
      .filter((q) =>
        q.and(
          q.gte(q.field("lat"), args.minLat),
          q.lte(q.field("lat"), args.maxLat),
          q.gte(q.field("lng"), args.minLng),
          q.lte(q.field("lng"), args.maxLng)
        )
      )
      .collect()

    return Promise.all(
      tiles.map(async (tile) => ({
        lat: tile.lat,
        lng: tile.lng,
        url: await ctx.storage.getUrl(tile.fileId),
        size: tile.size,
      }))
    )
  },
})

// Get upload URL for a tile (used by processing script)
export const getUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    // Generate upload URL
    return await ctx.storage.generateUploadUrl()
  },
})

// Complete upload after file is uploaded (called by processing script)
export const completeUpload = mutation({
  args: {
    lat: v.number(),
    lng: v.number(),
    storageId: v.id("_storage"),
    size: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if tile already exists
    const existing = await ctx.db
      .query("elevationTiles")
      .withIndex("by_lat_lng", (q) => q.eq("lat", args.lat).eq("lng", args.lng))
      .first()

    if (existing) {
      // Update existing tile
      await ctx.db.patch(existing._id, {
        fileId: args.storageId,
        size: args.size,
        uploadedAt: Date.now(),
      })
      return existing._id
    } else {
      // Create new tile record
      return await ctx.db.insert("elevationTiles", {
        lat: args.lat,
        lng: args.lng,
        fileId: args.storageId,
        size: args.size,
        uploadedAt: Date.now(),
      })
    }
  },
})

