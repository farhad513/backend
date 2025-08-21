const { Schema, model } = require('mongoose')

const adminSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true,
        select: false
    },
    image: {
        type: String,
        default: "https://i.ibb.co/qLT0W427/male.jpg"
    },
    role: {
        type: String,
        default: 'admin'
    },    
    expoPushToken: { type: String, default: "" }, 

})

module.exports = model('Admin',adminSchema)