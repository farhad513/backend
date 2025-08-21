const { Schema, model } = require("mongoose");

const authorSchema = new Schema(
  {
    appoinmentId: {
      type: Schema.ObjectId,
      required: true,
      ref: "Appoinment",
    },
    hospitalId: {
      type: Schema.ObjectId,
      required: true,
      ref: "Hospital",
    },
    doctorId: {
      type: Schema.ObjectId,
      required: true,
      ref: "Doctor",
    },
    status: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: Date,
      // required: true,
    },
    time: {
      type: Date,
      // required: true,
    },
    isComplete: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = model("AuthorAppoinment", authorSchema);
