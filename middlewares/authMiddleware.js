const jwt = require('jsonwebtoken');
module.exports.authMiddleware = (req, res, next) => {
 

  
  // const token = req.cookies.userToken || req.headers['authorization']?.split(' ')[1];
  const token =
  req.cookies.accessToken ||
  req.cookies.userToken ||
  req.headers['authorization']?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'টোকেন পাওয়া যায়নি। অনুগ্রহ করে লগইন করুন।' });
  }
  try {
    const userInfo = jwt.verify(token, process.env.SECRET);
    req.role = userInfo.role;
    req.id = userInfo.id;
    req.user = userInfo;
    next();
  } catch (error) {
    console.log("টোকেন যাচাই করতে ব্যর্থ:", error.message);
    return res.status(401).json({ message: 'অনুমতি নেই। দয়া করে সঠিকভাবে লগইন করুন।' });
  }
};
