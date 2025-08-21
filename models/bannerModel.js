const { Schema, model } = require("mongoose");

const bannerSchema = new Schema(
  {
    image: {
      url: {
        type: String,
      },
      public_id: {
        type: String,
        default: "N/A",
      },
    },
    validity: { type: String, required: true },
    expiryDate: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true }
);

module.exports = model("Banner", bannerSchema);
