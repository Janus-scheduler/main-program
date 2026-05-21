import mongoose from "mongoose";

const ResourceSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ["person", "room", "equipment"],
      default: "person",
    },
    email: { type: String, default: "" },
  },
  { timestamps: true },
);

export default mongoose.model("Resource", ResourceSchema);
