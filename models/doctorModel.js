const { Schema, model } = require("mongoose");

const slotSchema = new Schema(
  {
    day: {
      type: String, 
      required: true,
      enum: [
        "শনিবার",
        "রবিবার",
        "সোমবার",
        "মঙ্গলবার",
        "বুধবার",
        "বৃহস্পতিবার",
        "শুক্রবার"
      ],
    },
    startTime: {
      type: String, 
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);
const doctorSchema = new Schema(
  {
    hospitalId: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    fee: {
      type: String,
      required: true,
    },

    description: {
      type: String,
      required: true,
    },
    image: {
      url: { 
        type: String, 
        required: true 
      }, 
      public_id: { 
        type: String, 
        required: true 
      }, 
    },
    qualification: {
      type: String,
      required: true,
    },
    experience: {
      type: String,
      required: true,
    },
    slots: [slotSchema],
  },
  { timestamps: true }
);

doctorSchema.index(
  {
    name: "text",
    category: "text",
    description: "text",
  },
  {
    weights: {
      name: 5,
      category: 4,
      description: 2,
    },
  }
);

module.exports = model("Doctor", doctorSchema);
