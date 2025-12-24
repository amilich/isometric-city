import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  // Elevation tiles: 1°×1° tiles of Earth elevation data
  elevationTiles: defineTable({
    lat: v.number(), // Latitude of tile (integer, e.g., 40 for 40°N)
    lng: v.number(), // Longitude of tile (integer, e.g., -74 for 74°W)
    fileId: v.id("_storage"), // Convex file storage ID for the WebP tile
    size: v.number(), // File size in bytes
    uploadedAt: v.number(), // Timestamp
  })
    .index("by_lat_lng", ["lat", "lng"]),
})

