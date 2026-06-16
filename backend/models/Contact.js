const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
            minlength: [3, 'Name must be at least 3 characters']
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            lowercase: true,
            trim: true
        },
        phone: {
            type: String,
            required: [true, 'Phone number is required']
        },
        message: {
            type: String,
            required: [true, 'Message is required'],
            maxlength: [500, 'Message cannot exceed 500 characters']
        },
        inquiryType: {
            type: String,
            enum: ['Consultation', 'Business Inquiry', 'Support'],
            default: 'Business Inquiry'
        },
        status: {
            type: String,
            enum: ['Pending', 'Replied', 'Closed'],
            default: 'Pending'
        },
        ipAddress: String,
        userAgent: String
    },
    { timestamps: true }
);

module.exports = mongoose.model('Contact', contactSchema);
