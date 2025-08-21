const Notification = require('../../models/notificationModel');
const { responseReturn } = require('../../utiles/response'); // তোমার response helper

// ১. Create Notification
const createNotification = async (req, res) => {
  try {
    const {
      senderRole,
      senderId,
      receiverRole,
      receiverId,
      type,
      message,
      relatedId,
    } = req.body;

    if (!senderRole || !receiverRole || !message) {
      return responseReturn(res, 400, {
        error: "senderRole, receiverRole এবং message অবশ্যই দিতে হবে।",
      });
    }

    const newNotification = new Notification({
      senderRole,
      senderId: senderId || null,
      receiverRole,
      receiverId: receiverId || null,
      type: type || 'general',
      message,
      relatedId: relatedId || null,
    });

    await newNotification.save();

    return responseReturn(res, 201, {
      message: "নোটিফিকেশন সফলভাবে তৈরি হয়েছে।",
      notification: newNotification,
    });
  } catch (error) {
    console.error(error);
    return responseReturn(res, 500, {
      error: "সার্ভারে সমস্যা হয়েছে। পরে চেষ্টা করুন।",
    });
  }
};

// ২. Fetch Notifications by receiver
const fetchNotifications = async (req, res) => {
  const { receiverRole, receiverId } = req.query;

  if (!receiverRole) {
    return responseReturn(res, 400, {
      error: "receiverRole প্রয়োজন।",
    });
  }

  try {
    let query = {};
    if (receiverRole === 'all') {
      query = { receiverRole: 'all' };
    } else if (receiverId) {
      query = {
        $or: [
          { receiverRole: 'all' },
          { receiverRole, receiverId }
        ]
      };
    } else {
      query = { receiverRole };
    }

    const notifications = await Notification.find(query).sort({ createdAt: -1 });

    return responseReturn(res, 200, { notifications });
  } catch (error) {
    console.error(error);
    return responseReturn(res, 500, {
      error: "সার্ভারে সমস্যা হয়েছে। পরে চেষ্টা করুন।",
    });
  }
};

// ৩. Mark Notification as Read
const markAsRead = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return responseReturn(res, 400, { error: "Notification ID প্রয়োজন।" });
  }

  try {
    const notification = await Notification.findById(id);
    if (!notification) {
      return responseReturn(res, 404, { error: "Notification পাওয়া যায়নি।" });
    }

    notification.isRead = true;
    // যদি readAt রাখতে চাও, add: notification.readAt = new Date();
    await notification.save();

    return responseReturn(res, 200, {
      message: "Notification সফলভাবে পড়া হয়েছে।",
      notification,
    });
  } catch (error) {
    console.error(error);
    return responseReturn(res, 500, {
      error: "সার্ভারে সমস্যা হয়েছে। পরে চেষ্টা করুন।",
    });
  }
};

module.exports = {
  createNotification,
  fetchNotifications,
  markAsRead,
};
