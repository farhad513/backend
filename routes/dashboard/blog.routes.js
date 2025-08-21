const router = require('express').Router()
const { authMiddleware } = require('../../middlewares/authMiddleware')
const {addBlog, blog_get,delete_blog, get_blogs, blog_image_update,blog_update}  = require('../../controllers/dashboard/blog.controller')
router.post('/blog-add', authMiddleware, addBlog)
router.post('/blog-update', authMiddleware,blog_update )
router.post('/blog-image-update', authMiddleware, blog_image_update)
router.get('/blog-get', authMiddleware,get_blogs )
router.get('/blog-user-get',get_blogs )
router.get('/get-blog/:blogId', authMiddleware,blog_get )           
router.get('/get-user-blog/:blogId',blog_get )           
router.delete('/delete-blog/:id', authMiddleware, delete_blog)

module.exports = router