const { Schema, model } = require("mongoose");

const hospitalSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      match: /^01[0-9]{9}$/,
    },

    password: {
      type: String,
      required: true,
      select: false,
      validate: {
        validator: function (value) {
          return value.length >= 6;
        },
        message: "Password must be at least 6 characters long",
      },
    },
    role: {
      type: String,
      default: "hospital",
    },
    status: {
      type: String,
      default: "pending",
    },
    image: {
      type: String,
      default: "",
    },
    division: {
      type: String,
      default: "",
    },
    district: {
      type: String,
      default: "",
    },
    upazila: {
      type: String,
      default: "",
    },
    address: {
      type: String,
      default: "",
    },
    type: {
      type: String,
      default: "",
    },
    license: {
      type: String,
      default: "",
    },
    website: {
      type: String,
      default: "",
    },
    emergency: {
      type: String,
      default: "",
    },
    openingTime: {
      type: String,
      default: "",
    },
    closingTime: {
      type: String,
      default: "",
    },
    billDiscount: {
      type: String,
      default: "",
    },
    pathologyDiscount: {
      type: String,
      default: "",
    },
    profileUpdated: {
      type: Boolean,
      default: false,
    },
    expoPushToken: { type: String, default: "" }, 

  },
  { timestamps: true }
);

hospitalSchema.index(
  {
    name: "text",
    email: "text",
  },
  {
    weights: {
      name: 5,
      email: 4,
    },
  }
);
// Extra Performance Indexes
hospitalSchema.index({ status: 1, createdAt: -1 });
hospitalSchema.index({ phone: 1 });
hospitalSchema.index({ email: 1 });
hospitalSchema.index({ name: 1 });
module.exports = model("Hospital", hospitalSchema);
