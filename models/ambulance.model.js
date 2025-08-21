const mongoose = require("mongoose")

const ambulanceSchema = new mongoose.Schema(
  {
    ambulanceName: {
      type: String,
      required: true,
      trim: true,
    },
    driverName: {
      type: String,
      required: true,
      trim: true,
    },
    driverPhone: {
      type: String,
      required: true,
      trim: true,
    },
    registrationNumber: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["AC", "Non-AC", "ICU", "Deadbody Carry", "Normal"],
      default: "AC",
    },
    chargePerKm: {
      type: String,
      required: true,
      trim: true,
    },
    baseCharge: {
      type: String,
      required: true,
      trim: true,
    },
    insuranceExpiry: {
      type: Date,
      required: true,
    },
    joiningDate: {
      type: Date,
      required: true,
    },
    nidNumber: {
      type: String,
      required: true,
      trim: true,
    },
    emergencyPhone: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ["Hospital Owned", "Rented", "Private Contract"],
      default: "Hospital Owned",
    },
    oxygenSupport: {
      type: String,
      enum: ["Yes", "No"],
      default: "Yes",
    },
    image: {
      url: { 
        type: String, 
        required: true 
      }, // Store the image URL
      public_id: { 
        type: String, 
        required: true 
      }, // Store the public ID for Cloudinary or any image hosting service
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", ],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

// Optional: index for search optimization (ambulance name, driver phone)
ambulanceSchema.index({ ambulanceName: "text", driverPhone: "text" });


module.exports  = mongoose.model("Ambulance", ambulanceSchema);
