const router = require("express").Router();
const { authMiddleware } = require("../../middlewares/authMiddleware");

const {
  add_doctor,
  doctor_image_update,
  doctor_update,
  doctors_get,
  doctor_get,
  delete_doctor,
  doctors_get_admin
} = require("../../controllers/dashboard/doctorController");
router.post("/doctor-add", authMiddleware, add_doctor);
router.get("/doctors-get",authMiddleware,  doctors_get);
router.get("/doctors-get-admin",authMiddleware,  doctors_get_admin);
router.get("/doctor-get/:doctorId", authMiddleware, doctor_get);
router.post("/doctor-update", authMiddleware, doctor_update);
router.post("/doctor-image-update", authMiddleware, doctor_image_update);
router.delete("/doctor-delete/:id", authMiddleware, delete_doctor);
module.exports = router;
