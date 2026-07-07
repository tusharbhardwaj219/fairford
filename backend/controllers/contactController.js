const Contact = require('../models/Contact');
const { sendSuccess, sendError } = require('../utils/responseHandler');
const { sendAdminNotification, sendUserAutoReply } = require('../services/emailService');

// POST /api/contact — Submit contact form
const submitContact = async (req, res, next) => {
    try {
        const { name, email, phone, message, inquiryType } = req.body;

        const contact = await Contact.create({
            name,
            email,
            phone,
            message,
            inquiryType: inquiryType || 'Business Inquiry',
            ipAddress: req.ip || req.headers['x-forwarded-for'],
            userAgent: req.headers['user-agent'],
        });

        // Fire emails without blocking response on failure
        Promise.all([
            sendAdminNotification(contact),
            sendUserAutoReply(contact.name, contact.email),
        ]).catch(err => console.error('Email error:', err.message));

        return sendSuccess(res, 201, 'Message submitted successfully', contact);
    } catch (error) {
        next(error);
    }
};

// GET /api/contact — Get all contacts (admin)
// Supports: ?page=1&limit=10&search=name&status=Pending&inquiryType=Consultation
const getAllContacts = async (req, res, next) => {
    try {
        const {
            page = 1,
            limit = 10,
            search,
            status,
            inquiryType,
            sortBy = 'createdAt',
            order = 'desc',
        } = req.query;

        const filter = {};

        if (search) {
            // Escape regex metacharacters + cap length (ReDoS guard).
            const kw = String(search).slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.name = { $regex: kw, $options: 'i' };
        }
        if (status && ['Pending', 'Replied', 'Closed'].includes(status)) {
            filter.status = status;
        }
        if (inquiryType && ['Consultation', 'Business Inquiry', 'Support'].includes(inquiryType)) {
            filter.inquiryType = inquiryType;
        }

        const skip = (Number(page) - 1) * Number(limit);
        const sortOrder = order === 'asc' ? 1 : -1;

        const [contacts, total] = await Promise.all([
            Contact.find(filter)
                .sort({ [sortBy]: sortOrder })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            Contact.countDocuments(filter),
        ]);

        return sendSuccess(res, 200, 'Contacts fetched successfully', {
            contacts,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit)),
            },
        });
    } catch (error) {
        next(error);
    }
};

// GET /api/contact/:id — Get single contact
const getContactById = async (req, res, next) => {
    try {
        const contact = await Contact.findById(req.params.id);
        if (!contact) {
            return sendError(res, 404, 'Contact not found');
        }
        return sendSuccess(res, 200, 'Contact fetched successfully', contact);
    } catch (error) {
        next(error);
    }
};

// PUT /api/contact/:id — Update status
const updateContactStatus = async (req, res, next) => {
    try {
        const { status } = req.body;

        if (!status || !['Pending', 'Replied', 'Closed'].includes(status)) {
            return sendError(res, 400, 'Invalid status. Use: Pending, Replied, or Closed');
        }

        const contact = await Contact.findByIdAndUpdate(
            req.params.id,
            { status },
            { returnDocument: 'after', runValidators: true }
        );

        if (!contact) {
            return sendError(res, 404, 'Contact not found');
        }

        return sendSuccess(res, 200, 'Status updated successfully', contact);
    } catch (error) {
        next(error);
    }
};

// DELETE /api/contact/:id — Delete contact
const deleteContact = async (req, res, next) => {
    try {
        const contact = await Contact.findByIdAndDelete(req.params.id);
        if (!contact) {
            return sendError(res, 404, 'Contact not found');
        }
        return sendSuccess(res, 200, 'Contact deleted successfully', {});
    } catch (error) {
        next(error);
    }
};

// GET /api/contact/export — Export all contacts to Excel
const exportToExcel = async (req, res, next) => {
    try {
        const ExcelJS = require('exceljs');

        // Neutralise CSV/Excel formula injection: a cell beginning with = + - @
        // (or a tab/CR) is treated as a formula by spreadsheet apps. Prefix a
        // single quote so the value is rendered as literal text.
        const csvSafe = (v) => {
            if (typeof v !== 'string') return v;
            return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
        };

        const { status, inquiryType } = req.query;
        const filter = {};
        if (status) filter.status = status;
        if (inquiryType) filter.inquiryType = inquiryType;

        const contacts = await Contact.find(filter).sort({ createdAt: -1 }).lean();

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Fair Ford Pharmaceuticals';
        workbook.created = new Date();

        const sheet = workbook.addWorksheet('Contact Inquiries');

        sheet.columns = [
            { header: 'S.No',         key: 'sno',         width: 6  },
            { header: 'Name',         key: 'name',         width: 22 },
            { header: 'Email',        key: 'email',        width: 28 },
            { header: 'Phone',        key: 'phone',        width: 16 },
            { header: 'Inquiry Type', key: 'inquiryType',  width: 18 },
            { header: 'Message',      key: 'message',      width: 40 },
            { header: 'Status',       key: 'status',       width: 12 },
            { header: 'IP Address',   key: 'ipAddress',    width: 18 },
            { header: 'Submitted At', key: 'createdAt',    width: 22 },
        ];

        // Style header row
        sheet.getRow(1).eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F4C81' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        contacts.forEach((c, i) => {
            sheet.addRow({
                sno:         i + 1,
                name:        csvSafe(c.name),
                email:       csvSafe(c.email),
                phone:       csvSafe(c.phone),
                inquiryType: csvSafe(c.inquiryType),
                message:     csvSafe(c.message),
                status:      csvSafe(c.status),
                ipAddress:   csvSafe(c.ipAddress || ''),
                createdAt:   new Date(c.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
            });
        });

        // Auto-filter on header
        sheet.autoFilter = {
            from: { row: 1, column: 1 },
            to:   { row: 1, column: sheet.columns.length },
        };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="contact-inquiries-${Date.now()}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        next(error);
    }
};

module.exports = {
    submitContact,
    getAllContacts,
    getContactById,
    updateContactStatus,
    deleteContact,
    exportToExcel,
};
