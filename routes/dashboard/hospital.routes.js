const router = require("express").Router();
const { authMiddleware } = require("../../middlewares/authMiddleware");
const {
  get_active_hospitals,
  get_deactive_hospitals,
  get_hospital,
  get_hospital_request,
  hospital_status_update,
  query_hospitals
} = require("../../controllers/dashboard/hospital.controller");
router.get("/request-hospital-get", authMiddleware, get_hospital_request);

router.get("/get-hospitals", authMiddleware, get_active_hospitals);
router.get("/get-deactive-hospitals", authMiddleware, get_deactive_hospitals);
router.get("/get-user-hospitals",  query_hospitals);

router.get("/get-hospital/:hospitalId", authMiddleware, get_hospital);
router.post("/hospital-status-update", authMiddleware, hospital_status_update);

module.exports = router;
