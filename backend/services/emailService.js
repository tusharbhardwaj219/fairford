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

/**
 * Notify the distributor / stockist that an order has been routed to them.
 * Non-blocking by contract: callers should `.catch()` so a mail failure never
 * fails the order. Skips silently when SMTP credentials are not configured.
 */
const sendDistributorOrderNotification = async (distributor, order, retailer) => {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn('[email] EMAIL_USER/EMAIL_PASS not set — skipping distributor order notification');
        return;
    }
    if (!distributor || !distributor.email) return;

    const transporter = createTransporter();
    const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
    const addr = order.deliveryAddress || (retailer && retailer.shopAddress) || {};
    const addrLine = [addr.street, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');

    const rows = (order.items || []).map((i) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee;">${i.productName}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${i.quantity}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${inr(i.totalPrice)}</td>
        </tr>`).join('');

    await transporter.sendMail({
        from: `"Fair Ford Pharmaceuticals" <${process.env.EMAIL_USER}>`,
        to: distributor.email,
        subject: `New order ${order.orderNumber} routed to you — please fulfil`,
        html: `
            <div style="font-family:Arial,sans-serif;padding:20px;background:#f4f4f4;">
              <div style="background:#fff;padding:30px;border-radius:8px;max-width:640px;margin:0 auto;">
                <h2 style="color:#0F4C81;border-bottom:2px solid #0F4C81;padding-bottom:10px;margin-top:0;">
                  New Order Routed to You
                </h2>
                <p style="color:#555;">Hello ${distributor.businessName || distributor.name || 'Partner'},</p>
                <p style="color:#555;line-height:1.7;">
                  Order <strong>${order.orderNumber}</strong> has been routed to you for delivery.
                  Please arrange last-mile delivery to the retailer below.
                </p>

                <h3 style="color:#0F4C81;font-size:15px;margin:24px 0 6px;">Deliver to</h3>
                <p style="margin:2px 0;color:#333;">
                  <strong>${(retailer && (retailer.shopName || retailer.name)) || 'Retailer'}</strong><br>
                  ${addrLine || 'Address on file'}<br>
                  ${(retailer && retailer.phone) ? 'Phone: ' + retailer.phone : ''}
                </p>

                <table style="width:100%;border-collapse:collapse;margin-top:18px;">
                  <thead>
                    <tr>
                      <th style="padding:8px;text-align:left;border-bottom:2px solid #0F4C81;color:#555;">Product</th>
                      <th style="padding:8px;text-align:center;border-bottom:2px solid #0F4C81;color:#555;">Qty</th>
                      <th style="padding:8px;text-align:right;border-bottom:2px solid #0F4C81;color:#555;">Amount</th>
                    </tr>
                  </thead>
                  <tbody>${rows}</tbody>
                </table>

                <p style="text-align:right;margin-top:14px;font-size:16px;color:#0F4C81;">
                  <strong>Total: ${inr(order.totalAmount)}</strong>
                </p>
                <div style="margin-top:16px;padding:10px 14px;background:#fff8e6;border-left:4px solid #f59e0b;border-radius:4px;color:#7a5a00;font-size:14px;">
                  Payment: <strong>Cash on delivery</strong> — collect from the retailer on hand-off.
                </div>
              </div>
            </div>
        `,
    });
};

/**
 * Send a password-reset link. Throws on failure so the caller can roll back
 * the issued token (we don't want a dangling reset if the mail never sends).
 */
const sendPasswordResetEmail = async (email, name, resetUrl) => {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        throw new Error('EMAIL_USER/EMAIL_PASS not configured');
    }
    const transporter = createTransporter();
    await transporter.sendMail({
        from: `"Fair Ford Pharmaceuticals" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Reset your Fair Ford Pharma password',
        html: `
            <div style="font-family:Arial,sans-serif;padding:20px;background:#f4f4f4;">
              <div style="background:#fff;padding:30px;border-radius:8px;max-width:600px;margin:0 auto;">
                <h2 style="color:#0F4C81;border-bottom:2px solid #0F4C81;padding-bottom:10px;margin-top:0;">
                  Password Reset Request
                </h2>
                <p style="color:#333;font-size:15px;">Hello <strong>${name || 'there'}</strong>,</p>
                <p style="color:#555;line-height:1.7;">
                  We received a request to reset your password. Click the button below to choose a
                  new one. This link expires in <strong>1 hour</strong>.
                </p>
                <p style="text-align:center;margin:28px 0;">
                  <a href="${resetUrl}" style="background:#0F4C81;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:600;display:inline-block;">
                    Reset Password
                  </a>
                </p>
                <p style="color:#888;font-size:13px;line-height:1.6;">
                  If the button doesn't work, paste this link into your browser:<br>
                  <span style="color:#0F4C81;word-break:break-all;">${resetUrl}</span>
                </p>
                <p style="color:#888;font-size:13px;margin-top:24px;">
                  Didn't request this? You can safely ignore this email — your password won't change.
                </p>
                <div style="margin-top:30px;padding-top:18px;border-top:1px solid #eee;font-size:12px;color:#aaa;text-align:center;">
                  © ${new Date().getFullYear()} Fair Ford Pharmaceuticals Pvt. Ltd.
                </div>
              </div>
            </div>
        `,
    });
};

module.exports = { sendAdminNotification, sendUserAutoReply, sendDistributorOrderNotification, sendPasswordResetEmail };
