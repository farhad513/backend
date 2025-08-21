const router = require('express').Router()
const { authMiddleware } = require('../../middlewares/authMiddleware')
const {addAmbulance, getAmbulances, deleteAmbulance,ambulance_get, ambulance_update, ambulance_image_update, adminGetAmbulanceOrder, admin_ambulance_get, ambulance_order_status_update}  = require('../../controllers/dashboard/ambulance.controller')

router.post('/ambulance-add', authMiddleware, addAmbulance)
router.get('/get-ambulances', authMiddleware, adminGetAmbulanceOrder)
router.get('/admin-get-ambulance/:ambulanceId', authMiddleware, admin_ambulance_get)
router.post('/update-ambulance', authMiddleware,ambulance_update )
router.post('/image-update', authMiddleware, ambulance_image_update)
router.get('/ambulance-get', authMiddleware,getAmbulances )
router.get('/get-ambulance/:ambulanceId', authMiddleware,ambulance_get )
router.put('/ambulance-status/update/:ambulanceId',authMiddleware, ambulance_order_status_update)
router.delete('/delete-ambulance/:id', authMiddleware, deleteAmbulance)

module.exports = router