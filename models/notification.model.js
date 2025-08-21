const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  senderRole: {
    type: String,
    enum: ['user', 'hospital', 'admin', 'system'], // system হলে auto notification
    required: true,
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'senderRole',
    required: false,
  },
  receiverRole: {
    type: String,
    enum: ['user', 'hospital', 'admin', 'all'], // 'all' হলে সকলকে পাঠাবে
    required: true,
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'receiverRole',
    required: false, // 'all' হলে null থাকতে পারে
  },
  type: {
    type: String,
    enum: ['appointment', 'status_update', 'general', 'emergency', 'other'],
    default: 'general',
  },
  message: {
    type: String,
    required: true,
  },
  relatedId: {
    // যেকোন entity এর রেফারেন্স, যেমন appointmentId, bookingId ইত্যাদি
    type: mongoose.Schema.Types.ObjectId,
    default: null,
  },
  isRead: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Notification', notificationSchema);
