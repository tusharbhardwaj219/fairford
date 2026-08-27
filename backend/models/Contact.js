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
        // Optional structured B2B lead fields captured by the redesigned
        // business-inquiry form. All optional so older/simple submissions and
        // any other caller keep working unchanged.
        company: { type: String, trim: true, maxlength: 150 },
        businessType: { type: String, trim: true, maxlength: 60 },
        city: { type: String, trim: true, maxlength: 120 },
        productRequirement: { type: String, trim: true, maxlength: 250 },
        inquiryType: {
            type: String,
            // Superset: the eight business categories the contact form now
            // offers, plus the three legacy values so existing records and the
            // admin filter keep resolving.
            enum: [
                'Distributor Inquiry', 'Retailer Support', 'Hospital/Institutional Inquiry',
                'Bulk Order', 'Product Inquiry', 'Business Partnership', 'General Inquiry', 'Other',
                'Consultation', 'Business Inquiry', 'Support'
            ],
            default: 'General Inquiry'
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
