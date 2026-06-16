const { body, validationResult } = require('express-validator');

const contactValidationRules = [
    body('name')
        .trim()
        .notEmpty().withMessage('Name is required')
        .isLength({ min: 3 }).withMessage('Name must be at least 3 characters'),

    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Please provide a valid email address')
        .normalizeEmail(),

    body('phone')
        .trim()
        .notEmpty().withMessage('Phone number is required')
        .matches(/^[6-9]\d{9}$/).withMessage('Please provide a valid Indian mobile number (10 digits starting with 6-9)'),

    body('message')
        .trim()
        .notEmpty().withMessage('Message is required')
        .isLength({ max: 500 }).withMessage('Message cannot exceed 500 characters'),

    body('inquiryType')
        .optional()
        .isIn(['Consultation', 'Business Inquiry', 'Support'])
        .withMessage('Invalid inquiry type. Choose: Consultation, Business Inquiry, or Support'),
];

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array().map(e => ({ field: e.path, message: e.msg }))
        });
    }
    next();
};

module.exports = { contactValidationRules, validate };
