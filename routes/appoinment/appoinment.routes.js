const router = require('express').Router()
const {get_hospital_appoinments, get_hospital_appoinment,  hospital_appoinment_status_update,  get_admin_appoinments, get_appoinments, placeAppointment, } = require("../../controllers/appoinment/appoinment.controller")
const { authMiddleware } = require('../../middlewares/authMiddleware')

// ---- customer
router.post('/home/appoinment/place-appoinment', authMiddleware, placeAppointment)
router.get('/home/customer/get-appoinments/:userId/:status',authMiddleware,get_appoinments)

// --- admin
router.get('/admin/appoinments',authMiddleware, get_admin_appoinments)


// ---hospital
router.get('/hospital/appoinments/:hospitalId', authMiddleware,get_hospital_appoinments)
router.get('/hospital/appoinment/:appoinmentId',authMiddleware, get_hospital_appoinment)
router.put('/hospital/appoinment-status/update/:appoinmentId',authMiddleware, hospital_appoinment_status_update)

module.exports = router