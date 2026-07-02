const crypto = require('crypto');
const nodemailer = require('nodemailer');
const Newsletter = require('../models/Newsletter');

const getTransporter = () => nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const generateUnsubscribeToken = () => crypto.randomBytes(32).toString('hex');

const sendWelcomeEmail = async (email, name) => {
  try {
    await getTransporter().sendMail({
      from: process.env.EMAIL_USER || 'noreply@fairfordpharma.com',
      to: email,
      subject: 'Welcome to Fair Ford Pharmaceuticals Newsletter',
      html: `
        <html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#333">
          <div style="max-width:600px;margin:0 auto;padding:20px">
            <h1 style="color:#1e3a8a">Welcome to Our Newsletter!</h1>
            <p>Hello ${name || 'Valued Customer'},</p>
            <p>Thank you for subscribing to Fair Ford Pharmaceuticals newsletter. You'll now receive:</p>
            <ul style="color:#555">
              <li>Latest pharmaceutical products and offers</li>
              <li>Exclusive distributor and retailer programs</li>
              <li>Industry updates and health tips</li>
              <li>Special promotions and deals</li>
            </ul>
            <hr style="border:none;border-top:1px solid #ddd;margin:30px 0">
            <p style="color:#888;font-size:12px">
              Fair Ford Pharmaceuticals PVT. LTD.<br>
              KHEWAT NO-755, KHATON NO-782<br>
              Faridabad, Haryana 121003<br>
              Phone: +91-9958584020
            </p>
          </div>
        </body></html>`
    });
    return true;
  } catch (err) {
    console.error('Welcome email error:', err);
    return false;
  }
};

// POST /api/newsletter/subscribe
exports.subscribe = async (req, res) => {
  try {
    const { email, name, userType } = req.body;

    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });
    if (!validateEmail(email)) return res.status(400).json({ success: false, message: 'Invalid email format' });

    const existing = await Newsletter.findOne({ email: email.toLowerCase() });

    if (existing) {
      if (existing.isActive) {
        return res.status(409).json({ success: false, message: 'Email already subscribed' });
      }
      existing.isActive = true;
      existing.subscriptionDate = new Date();
      existing.unsubscribedAt = null;
      await existing.save();
      await sendWelcomeEmail(email, name);
      return res.status(200).json({ success: true, message: 'Subscription reactivated successfully' });
    }

    const subscriber = await Newsletter.create({
      email: email.toLowerCase(),
      name: name || null,
      userType: userType || 'general',
      unsubscribeToken: generateUnsubscribeToken()
    });

    await sendWelcomeEmail(email, name);

    return res.status(201).json({
      success: true,
      message: 'Successfully subscribed to newsletter',
      data: { email: subscriber.email, subscriptionDate: subscriber.subscriptionDate }
    });
  } catch (err) {
    console.error('Subscribe error:', err);
    return res.status(500).json({ success: false, message: 'Subscription failed. Please try again.' });
  }
};

// POST /api/newsletter/unsubscribe
exports.unsubscribe = async (req, res) => {
  try {
    const { email, token } = req.body;

    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });
    // Require the token from the emailed unsubscribe link, otherwise anyone
    // could unsubscribe an arbitrary address just by knowing the email.
    if (!token) return res.status(400).json({ success: false, message: 'Unsubscribe token is required' });

    const subscriber = await Newsletter.findOne({ email: email.toLowerCase() });
    if (!subscriber) return res.status(404).json({ success: false, message: 'Subscriber not found' });

    if (subscriber.unsubscribeToken !== token) {
      return res.status(401).json({ success: false, message: 'Invalid unsubscribe token' });
    }

    subscriber.isActive = false;
    subscriber.unsubscribedAt = new Date();
    await subscriber.save();

    return res.status(200).json({ success: true, message: 'Successfully unsubscribed from newsletter' });
  } catch (err) {
    console.error('Unsubscribe error:', err);
    return res.status(500).json({ success: false, message: 'Unsubscribe failed' });
  }
};

// GET /api/newsletter/status/:email
exports.getStatus = async (req, res) => {
  try {
    const { email } = req.params;
    if (!validateEmail(email)) return res.status(400).json({ success: false, message: 'Invalid email format' });

    const subscriber = await Newsletter.findOne({ email: email.toLowerCase() });
    if (!subscriber) {
      return res.status(404).json({ success: false, message: 'Email not subscribed', isSubscribed: false });
    }

    return res.status(200).json({
      success: true,
      isSubscribed: subscriber.isActive,
      data: {
        email: subscriber.email,
        name: subscriber.name,
        userType: subscriber.userType,
        subscriptionDate: subscriber.subscriptionDate,
        unsubscribedAt: subscriber.unsubscribedAt
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error checking subscription status' });
  }
};

// POST /api/newsletter/send-campaign  (Admin only)
exports.sendCampaign = async (req, res) => {
  try {
    const { subject, html, userTypes } = req.body;

    if (!subject || !html) {
      return res.status(400).json({ success: false, message: 'Subject and content are required' });
    }

    const query = { isActive: true };
    if (userTypes && userTypes.length > 0) query.userType = { $in: userTypes };

    const subscribers = await Newsletter.find(query);
    if (subscribers.length === 0) {
      return res.status(404).json({ success: false, message: 'No subscribers found' });
    }

    let successCount = 0;
    let failureCount = 0;

    for (const sub of subscribers) {
      try {
        const unsubLink = `${process.env.FRONTEND_URL}/newsletter/unsubscribe?email=${sub.email}&token=${sub.unsubscribeToken}`;
        await getTransporter().sendMail({
          from: process.env.EMAIL_USER || 'noreply@fairfordpharma.com',
          to: sub.email,
          subject,
          html: html + `<hr style="margin-top:40px;border:none;border-top:1px solid #ddd"><p style="font-size:12px;color:#888"><a href="${unsubLink}">Unsubscribe</a></p>`
        });
        sub.lastEmailSent = new Date();
        await sub.save();
        successCount++;
      } catch (e) {
        console.error(`Email failed for ${sub.email}:`, e);
        failureCount++;
      }
    }

    return res.status(200).json({
      success: true,
      message: `Campaign sent: ${successCount} successful, ${failureCount} failed`,
      stats: { totalSubscribers: subscribers.length, successCount, failureCount }
    });
  } catch (err) {
    console.error('Campaign error:', err);
    return res.status(500).json({ success: false, message: 'Error sending campaign' });
  }
};

// GET /api/newsletter/stats  (Admin only)
exports.getStats = async (req, res) => {
  try {
    const [totalSubscribers, activeSubscribers, inactiveSubscribers, byUserType] = await Promise.all([
      Newsletter.countDocuments(),
      Newsletter.countDocuments({ isActive: true }),
      Newsletter.countDocuments({ isActive: false }),
      Newsletter.aggregate([{ $match: { isActive: true } }, { $group: { _id: '$userType', count: { $sum: 1 } } }])
    ]);

    return res.status(200).json({
      success: true,
      data: { totalSubscribers, activeSubscribers, inactiveSubscribers, byUserType }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error fetching statistics' });
  }
};

module.exports = exports;
