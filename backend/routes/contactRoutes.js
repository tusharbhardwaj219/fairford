const express = require('express');
const rateLimit = require('express-rate-limit');

const {
    submitContact,
    getAllContacts,
    getContactById,
    updateContactStatus,
    deleteContact,
    exportToExcel,
} = require('../controllers/contactController');

const { contactValidationRules, validate } = require('../validators/contactValidator');

const router = express.Router();

// 10 submissions per 15 minutes per IP — anti-spam
const contactLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, message: 'Too many submissions. Please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * @swagger
 * tags:
 *   name: Contact
 *   description: Contact form submission and admin management
 */

/**
 * @swagger
 * /api/contact:
 *   post:
 *     summary: Submit contact form
 *     tags: [Contact]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, phone, message]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Rahul Sharma
 *               email:
 *                 type: string
 *                 example: rahul@gmail.com
 *               phone:
 *                 type: string
 *                 example: "9876543210"
 *               message:
 *                 type: string
 *                 example: I want distributorship details
 *               inquiryType:
 *                 type: string
 *                 enum: [Consultation, Business Inquiry, Support]
 *                 example: Business Inquiry
 *     responses:
 *       201:
 *         description: Message submitted successfully
 *       400:
 *         description: Validation error
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/', contactLimiter, contactValidationRules, validate, submitContact);

/**
 * @swagger
 * /api/contact:
 *   get:
 *     summary: Get all contact inquiries (admin)
 *     tags: [Contact]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Pending, Replied, Closed]
 *       - in: query
 *         name: inquiryType
 *         schema:
 *           type: string
 *           enum: [Consultation, Business Inquiry, Support]
 *     responses:
 *       200:
 *         description: List of contacts with pagination
 */
router.get('/', getAllContacts);

/**
 * @swagger
 * /api/contact/export:
 *   get:
 *     summary: Export contact inquiries to Excel (admin)
 *     tags: [Contact]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Pending, Replied, Closed]
 *       - in: query
 *         name: inquiryType
 *         schema:
 *           type: string
 *           enum: [Consultation, Business Inquiry, Support]
 *     responses:
 *       200:
 *         description: Excel file download
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/export', exportToExcel);

/**
 * @swagger
 * /api/contact/{id}:
 *   get:
 *     summary: Get single contact by ID
 *     tags: [Contact]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Contact details
 *       404:
 *         description: Contact not found
 */
router.get('/:id', getContactById);

/**
 * @swagger
 * /api/contact/{id}:
 *   put:
 *     summary: Update contact status (admin)
 *     tags: [Contact]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [Pending, Replied, Closed]
 *                 example: Replied
 *     responses:
 *       200:
 *         description: Status updated
 *       400:
 *         description: Invalid status
 *       404:
 *         description: Contact not found
 */
router.put('/:id', updateContactStatus);

/**
 * @swagger
 * /api/contact/{id}:
 *   delete:
 *     summary: Delete a contact message (admin)
 *     tags: [Contact]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Contact deleted
 *       404:
 *         description: Contact not found
 */
router.delete('/:id', deleteContact);

module.exports = router;
