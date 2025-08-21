const router = require("express").Router();
const {
  add_banner,
  get_banner,
  get_banners,
  update_banner,
  delete_banner,
} = require("../controllers/bannerController");

const { authMiddleware } = require("../middlewares/authMiddleware");

router.post("/site-banner/add", authMiddleware, add_banner);
router.get("/site-banner/get/:id", authMiddleware, get_banner);
router.get("/site-banner/get-banners", get_banners);
router.put("/site-banner/update/:id", authMiddleware, update_banner);
router.delete('/site-banner/delete/:id', authMiddleware, delete_banner);

module.exports = router;
