const express = require('express')
const { dbConnect } = require('./utiles/db')
const morgan = require('morgan')
const app = express()
const cors = require('cors')
const http = require('http')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
require('dotenv').config()
const socket = require('socket.io')
const { globalLimiter } = require('./middlewares/rateLimiter')
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const mode = process.env.mode
const server = http.createServer(app)
require("./utiles/Redis")

app.use(cors({
    origin: mode === 'production'
        ? ['http://localhost:3000', process.env.user_panel_production_url, process.env.admin_panel_production_url]
        : ['http://localhost:5173', 'http://localhost:3001'],
    credentials: true
}))
const io = socket(server, {
    cors: {
      origin:
        mode === 'production'
          ? [
              'http://localhost:3000',
              process.env.user_panel_production_url,
              process.env.admin_panel_production_url,
            ]
          : ['http://localhost:5173', 'http://localhost:3001'],
      credentials: true,
    },
  });
  
  let allUser = [];
  let allHospital = [];
  let admin = {};
  
  // Add user if not exists
  const addUser = (userId, socketId, userInfo) => {
    const exists = allUser.some((u) => u.userId === userId);
    if (!exists) {
      allUser.push({ userId, socketId, userInfo });
    }
  };
  
  // Add hospital if not exists
  const addHospital = (hospitalId, socketId, userInfo) => {
    const exists = allHospital.some((h) => h.hospitalId === hospitalId);
    if (!exists) {
      allHospital.push({ hospitalId, socketId, userInfo });
    }
  };
  
  // Remove user and hospital on disconnect
  const removeUserBySocket = (socketId) => {
    allUser = allUser.filter((u) => u.socketId !== socketId);
    allHospital = allHospital.filter((h) => h.socketId !== socketId);
    if (admin.socketId === socketId) {
      admin = {};
    }
  };
  
  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);
  
    socket.on('add_user', (userId, userInfo) => {
      addUser(userId, socket.id, userInfo);
      io.emit('activeHospital', allHospital);
      io.emit('activeUser', allUser);
    });
  
    socket.on('add_seller', (hospitalId, userInfo) => {
      addHospital(hospitalId, socket.id, userInfo);
      io.emit('activeHospital', allHospital);
      io.emit('activeUser', allUser);
      io.emit('activeAdmin', { status: true });
    });
  
    socket.on('add_admin', (adminInfo) => {
      delete adminInfo.email; // remove email for privacy if needed
      admin = { ...adminInfo, socketId: socket.id };
      io.emit('activeHospital', allHospital);
      io.emit('activeAdmin', { status: true });
    });
  
    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id);
      removeUserBySocket(socket.id);
      io.emit('activeAdmin', { status: admin.socketId ? true : false });
      io.emit('activeHospital', allHospital);  // **এইখানে ব্যাকটিক সরানো হয়েছে**
      io.emit('activeUser', allUser);
    });
  });

app.use(bodyParser.json())
app.use(cookieParser())
app.use(morgan("dev"))
app.use(globalLimiter);
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://cdnjs.cloudflare.com'],
      styleSrc: ["'self'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:'],
    },
  })
);
app.use(mongoSanitize()); 
app.use(xss());
// app.enable('trust proxy');


app.use('/api', require('./routes/bannerRoutes'))
app.use('/api/home', require('./routes/home/homeRoutes'))
app.use('/api', require('./routes/authRoutes'))
app.use('/api', require('./routes/home/userRoutes'))
app.use('/api', require('./routes/dashboard/categoryRoutes'))
app.use('/api', require('./routes/dashboard/doctorRoutes'))
app.use('/api', require('./routes/appoinment/appoinment.routes'))
app.use('/api', require('./routes/dashboard/dashboardIndexRoutes'))
app.use('/api', require('./routes/dashboard/hospital.routes'))
app.use('/api/blog', require('./routes/dashboard/blog.routes'))
app.use('/api/ambulance', require('./routes/dashboard/ambulance.routes'))
app.use('/api', require('./routes/chatRoutes'))
// app.use('/api', require('./routes/dashboard/notification.routes'))

app.get('/', (req, res) => res.send('Hello World!'))

const port = process.env.PORT
dbConnect()
server.listen(port, () => console.log(`Server is running on port ${port}!`))
