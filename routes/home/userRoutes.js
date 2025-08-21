const {  user_login, user_logout, query_bloodDoners, profileAddedOrUpdated, getUser, user_image_upload ,sendOtpForRegistration,verifyAndRegister, pushTokenUser} = require('../../controllers/home/userController')
const { authMiddleware } = require('../../middlewares/authMiddleware')

const router = require('express').Router()
router.post("/user/send-otp", sendOtpForRegistration);
router.post("/user/verify-register", verifyAndRegister);

router.post('/user/user-login', user_login)
router.post('/user/user-profile', authMiddleware, profileAddedOrUpdated)
router.get('/user/get-user-donners',authMiddleware, query_bloodDoners)
router.get('/user/get-user',authMiddleware, getUser)


router.get('/user/logout', user_logout)

router.post('/user-image-upload',authMiddleware, user_image_upload)

router.post('/user/saved-token-user',authMiddleware,pushTokenUser)

module.exports = router

