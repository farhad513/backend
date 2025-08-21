const router = require('express').Router()
const { authMiddleware } = require('../../middlewares/authMiddleware')
const { get_hospital_dashboard_data,get_admin_dashboard_data } = require('../../controllers/dashboard/dashboardIndexController')
router.get('/hospital/get-dashboard-index-data', authMiddleware, get_hospital_dashboard_data)
router.get('/admin/get-dashboard-index-data', authMiddleware, get_admin_dashboard_data)

module.exports = router