import mongoose from "mongoose";
import { env } from "@/lib/env";

const MONGODB_URI = env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("Missing MONGODB_URI environment variable");
}

/**
 * Extend the global object with a custom mongoose cache property
 * to ensure that the connection is reused across HMR in development.
 */
declare global {
  var mongooseCache: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
}

let cached = global.mongooseCache;

if (!cached) {
  cached = global.mongooseCache = { conn: null, promise: null };
}

/**
 * Connects to the MongoDB database.
 * Reuses the existing connection if one is already established.
 */
export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose
      .connect(MONGODB_URI, opts)
      .then((mongooseInstance) => {
        if (env.NODE_ENV !== "test") {
          console.log("✓ MongoDB connected successfully");
        }
        return mongooseInstance;
      })
      .catch((err) => {
        console.error("✗ MongoDB connection failed:", err);
        throw err;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}
