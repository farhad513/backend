const mongoose = require("mongoose");

const customerAppoinmentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
    },
    patientName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    appointmentDate: {
      type: Date,
      // required: true,
    },
    time: {
      type: Date,
      // required: true,
    },
    address: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled"],
      default: "pending",
    },
    serial: {
      type: Number,
      default: 0,
    },
    age: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      enum: ["প্রথম বার", "ফলো আপ", "রিপোর্ট দেখানো"],
      required: true,
    },
    isComplete: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Appoinment", customerAppoinmentSchema);
