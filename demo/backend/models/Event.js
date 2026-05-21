import mongoose from "mongoose";

const EventSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    resourceId: { type: String, required: true },
    status: {
      type: String,
      enum: ["draft", "confirmed", "cancelled"],
      default: "draft",
    },
    description: { type: String, default: "" },
  },
  { timestamps: true },
);

export default mongoose.model("Event", EventSchema);
