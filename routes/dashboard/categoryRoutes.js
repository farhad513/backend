const router = require('express').Router()
const { authMiddleware } = require('../../middlewares/authMiddleware')
// const categoryController = require('../../controllers/dashboard/categoryController')
const {add_category, get_category, edit_category, delete_category, get_all_categories}  = require('../../controllers/dashboard/categoryController')
router.post('/category-add', authMiddleware, add_category)
router.get('/category-get', authMiddleware, get_category)
router.get('/category/get', authMiddleware, get_all_categories)

router.put('/category-edit/:id', authMiddleware, edit_category)
router.delete('/category-delete/:id', authMiddleware, delete_category)

module.exports = router