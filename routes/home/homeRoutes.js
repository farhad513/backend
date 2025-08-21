const router = require('express').Router()
// const homeControllers = require('../../controllers/home/homeControllers')
const {formateProduct,get_category,get_categorys,get_doctor,get_doctors, query_doctors, createContact, getHospitals, getDoctorsByHospital, placeAmbulanceBooking, get_ambulances, getAllHospitals} = require("../../controllers/home/homeControllers")
const { authMiddleware } = require('../../middlewares/authMiddleware')

router.post('/ambulance/place-booking', authMiddleware, placeAmbulanceBooking)

router.get('/get-ambulances/:userId/:status',authMiddleware,get_ambulances)
router.get('/get-categorys', get_categorys)
router.get('/get-category', get_category)
router.get('/get-doctors',authMiddleware, get_doctors)
router.get('/get-hospitals',authMiddleware, getHospitals)
router.get("/doctors-by-hospital/:hospitalId", getDoctorsByHospital);

router.get('/get-doctor/:id', get_doctor)
router.get('/query-doctors', query_doctors)
router.post('/create-contact', createContact)
router.get('/get-all-hospital', getAllHospitals)


module.exports = router