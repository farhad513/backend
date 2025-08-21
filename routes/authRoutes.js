const router = require('express').Router()
const { admin_login, getUser,get_all_users, logout, profile_image_upload,profile_info_add,hospital_login,hospital_register, pushTokenNot, pushTokenNotAdmin } = require('../controllers/authControllers')
const { authMiddleware } = require('../middlewares/authMiddleware')
router.post('/admin-login',admin_login)
router.get('/get-user', authMiddleware, getUser)
router.get('/all-users', authMiddleware, get_all_users)
router.post('/hospital-register', hospital_register)
router.post('/hospital-login', hospital_login)
router.post('/profile-image-upload',authMiddleware, profile_image_upload)
router.post('/profile-info-add',authMiddleware, profile_info_add)

router.get('/logout',authMiddleware,logout)
router.post('/saved-token',authMiddleware,pushTokenNot)
router.post('/saved-token-admin',authMiddleware,pushTokenNotAdmin)

module.exports = router