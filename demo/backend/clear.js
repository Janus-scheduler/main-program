import mongoose from "mongoose";
import dotenv from "dotenv";
import Event from "./models/Event.js";
import Resource from "./models/Resource.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("FATAL: MONGO_URI is missing from .env");
  process.exit(1);
}

async function clear() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB for clearing...");

    const eventResult = await Event.deleteMany({});
    console.log(`Deleted ${eventResult.deletedCount} events.`);

    const resourceResult = await Resource.deleteMany({});
    console.log(`Deleted ${resourceResult.deletedCount} resources.`);

    console.log("Database cleared successfully!");
  } catch (error) {
    console.error("Error clearing database:", error);
  } finally {
    await mongoose.disconnect();
  }
}

clear();
