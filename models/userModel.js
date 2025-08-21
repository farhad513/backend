const { Schema, model } = require("mongoose");

const validator = require("validator");
const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
    },
    avatar: {
      url: {
        type: String,
        validate: [validator.isURL, "Please provide a valid avatar URL"],
        // default: "https://i.ibb.co.com/HL7tYjw3/profile.png",
      },
      public_id: {
        type: String,
        default: "N/A",
      },
    },
    phone: {
      type: String,
      unique: true,
    },

    password: {
      type: String,
      // required: true,
      select: false,
      validate: {
        validator: function (value) {
          return value.length >= 6;
        },
        message: "Password must be at least 6 characters long",
      },
    },
    address: {
      type: String,
      trim: true,
      maxLength: [500, "Your address would be at most 500 characters"],
    },
    age: {
      type: String,
      default: "",
    },
    bloodGroup: {
      type: String,
      // required: true,
      enum: ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"],
    },
    lastBloodDate: {
      type: Date,
      default: null,
    },
    dob: {
      type: Date,
      default: null,
    },

    gender: {
      type: String,
      // required: true,
      enum: ["পুরুষ", "মহিলা", "অন্যান্য"],
    },

    totalDonate: {
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
    donateBlood: {
      type: String,
      default: "no",
    },
    role: {
      type: String,
      default: "user",
    },
    expoPushToken: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = model("User", userSchema);
