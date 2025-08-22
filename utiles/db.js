const mongoose = require("mongoose");

module.exports.dbConnect = async () => {
  try {
    await mongoose.connect(process.env.DB_LOCAL_URL, { useNewURLParser: true });
    console.log("Local database connect....");
  } catch (error) {
    console.log(`Database connection error ${error.message}`);

    // process.exit(1);
  }
};
