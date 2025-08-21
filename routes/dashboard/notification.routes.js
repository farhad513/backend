const router = require("express").Router();
const {
  createNotification,
  fetchNotifications,
  markAsRead,
} = require('../../controllers/dashboard/notification.controller');

router.post('/notifications/create', createNotification);

router.get('/notifications', fetchNotifications);

router.put('/notifications/:id/read', markAsRead);

module.exports = router;
