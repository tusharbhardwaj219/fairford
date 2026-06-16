const nodemailer = require('nodemailer');

const createTransporter = () => {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
};

const sendAdminNotification = async (contactData) => {
    const transporter = createTransporter();

    await transporter.sendMail({
        from: `"Fair Ford Pharmaceuticals" <${process.env.EMAIL_USER}>`,
        to: process.env.ADMIN_EMAIL,
        subject: 'New Contact Inquiry',
        html: `
            <div style="font-family:Arial,sans-serif;padding:20px;background:#f4f4f4;">
              <div style="background:#fff;padding:30px;border-radius:8px;max-width:600px;margin:0 auto;">
                <h2 style="color:#0F4C81;border-bottom:2px solid #0F4C81;padding-bottom:10px;">
                  New Contact Inquiry
                </h2>
                <table style="width:100%;border-collapse:collapse;margin-top:20px;">
                  <tr>
                    <td style="padding:12px 0;border-bottom:1px solid #eee;font-weight:bold;color:#555;width:140px;">Name:</td>
                    <td style="padding:12px 0;border-bottom:1px solid #eee;color:#333;">${contactData.name}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px 0;border-bottom:1px solid #eee;font-weight:bold;color:#555;">Email:</td>
                    <td style="padding:12px 0;border-bottom:1px solid #eee;color:#333;">${contactData.email}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px 0;border-bottom:1px solid #eee;font-weight:bold;color:#555;">Phone:</td>
                    <td style="padding:12px 0;border-bottom:1px solid #eee;color:#333;">${contactData.phone}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px 0;border-bottom:1px solid #eee;font-weight:bold;color:#555;">Inquiry Type:</td>
                    <td style="padding:12px 0;border-bottom:1px solid #eee;color:#333;">${contactData.inquiryType}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px 0;font-weight:bold;color:#555;vertical-align:top;">Message:</td>
                    <td style="padding:12px 0;color:#333;">${contactData.message}</td>
                  </tr>
                </table>
                <div style="margin-top:20px;padding:10px;background:#f9f9f9;border-radius:4px;font-size:12px;color:#888;">
                  <p style="margin:4px 0;">Submitted: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
                  <p style="margin:4px 0;">IP Address: ${contactData.ipAddress || 'N/A'}</p>
                  <p style="margin:4px 0;">User Agent: ${contactData.userAgent || 'N/A'}</p>
                </div>
              </div>
            </div>
        `,
    });
};

const sendUserAutoReply = async (name, email) => {
    const transporter = createTransporter();

    await transporter.sendMail({
        from: `"Fair Ford Pharmaceuticals" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Thank You For Contacting Fair Ford Pharma',
        html: `
            <div style="font-family:Arial,sans-serif;padding:20px;background:#f4f4f4;">
              <div style="background:#fff;padding:30px;border-radius:8px;max-width:600px;margin:0 auto;">
                <div style="text-align:center;margin-bottom:30px;">
                  <h1 style="color:#0F4C81;font-size:22px;margin:0;">Fair Ford Pharmaceuticals</h1>
                  <p style="color:#888;font-size:13px;margin-top:4px;">Pvt. Ltd.</p>
                </div>
                <p style="color:#333;font-size:16px;">Dear <strong>${name}</strong>,</p>
                <p style="color:#555;line-height:1.8;">Thank you for contacting us.</p>
                <p style="color:#555;line-height:1.8;">
                  Our team has received your inquiry and will respond within <strong>24 hours</strong>.
                </p>
                <div style="margin:30px 0;padding:20px;background:#f0f7ff;border-left:4px solid #0F4C81;border-radius:4px;">
                  <p style="margin:0;color:#0F4C81;font-weight:bold;">Need immediate assistance?</p>
                  <p style="margin:6px 0 0;color:#555;">
                    Call us: <a href="tel:+919958584020" style="color:#0F4C81;">+91 9958584020</a>
                  </p>
                  <p style="margin:4px 0 0;color:#555;">
                    Email: <a href="mailto:info@fairfordpharma.com" style="color:#0F4C81;">info@fairfordpharma.com</a>
                  </p>
                </div>
                <p style="color:#555;margin-top:30px;">
                  Regards,<br>
                  <strong>Fair Ford Pharmaceuticals Pvt Ltd</strong>
                </p>
                <div style="margin-top:30px;padding-top:20px;border-top:1px solid #eee;font-size:12px;color:#aaa;text-align:center;">
                  © ${new Date().getFullYear()} Fair Ford Pharmaceuticals Pvt. Ltd. All rights reserved.<br>
                  Village Anangpur, Faridabad, Haryana 121003
                </div>
              </div>
            </div>
        `,
    });
};

module.exports = { sendAdminNotification, sendUserAutoReply };
