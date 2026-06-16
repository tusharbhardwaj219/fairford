const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const router = express.Router();

// Create Newsletter model
const { newsletterSchema } = require('../src/model');
const Newsletter = mongoose.model('Newsletter', newsletterSchema);

// ============ EMAIL CONFIGURATION ============

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASSWORD || 'your-app-password'
  }
});

// ============ HELPER FUNCTIONS ============

const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

const generateUnsubscribeToken = () => {
  return require('crypto').randomBytes(32).toString('hex');
};

const sendWelcomeEmail = async (email, name) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER || 'noreply@fairfordpharma.com',
      to: email,
      subject: 'Welcome to Fair Ford Pharmaceuticals Newsletter',
      html: `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <img src="cid:logo" alt="Fair Ford Pharmaceuticals" style="max-width: 200px; margin-bottom: 20px;">
              
              <h1 style="color: #1e3a8a; margin-bottom: 20px;">Welcome to Our Newsletter!</h1>
              
              <p>Hello ${name || 'Valued Customer'},</p>
              
              <p>Thank you for subscribing to Fair Ford Pharmaceuticals newsletter. You'll now receive:</p>
              
              <ul style="color: #555;">
                <li>Latest pharmaceutical products and offers</li>
                <li>Exclusive distributor and retailer programs</li>
                <li>Industry updates and health tips</li>
                <li>Special promotions and deals</li>
              </ul>
              
              <p>We're committed to providing the best quality pharmaceutical products to retailers and distributors across India.</p>
              
              <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
              
              <p style="color: #888; font-size: 12px;">
                Fair Ford Pharmaceuticals PVT. LTD.<br>
                KHEWAT NO-755, KHATON NO-782<br>
                Faridabad, Haryana 121003<br>
                Phone: +91-9958584020
              </p>
            </div>
          </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return false;
  }
};

// ============ ROUTES ============

// @POST /api/newsletter/subscribe
// Subscribe to newsletter
router.post('/subscribe', async (req, res) => {
  console.log(req.body);
  try {
    const { email, name, userType } = req.body;

    // Validation
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Check if already subscribed
    const existingSubscriber = await Newsletter.findOne({ 
      email: email.toLowerCase() 
    });

    if (existingSubscriber) {
      if (existingSubscriber.isActive) {
        return res.status(409).json({
          success: false,
          message: 'Email already subscribed'
        });
      } else {
        // Reactivate subscription
        existingSubscriber.isActive = true;
        existingSubscriber.subscriptionDate = new Date();
        existingSubscriber.unsubscribedAt = null;
        await existingSubscriber.save();

        // Send welcome email
        await sendWelcomeEmail(email, name);

        return res.status(200).json({
          success: true,
          message: 'Subscription reactivated successfully'
        });
      }
    }

    // Create new subscriber
    const unsubscribeToken = generateUnsubscribeToken();
    
    const newSubscriber = new Newsletter({
      email: email.toLowerCase(),
      name: name || null,
      userType: userType || 'general',
      unsubscribeToken
    });

    await newSubscriber.save();

    // Send welcome email
    await sendWelcomeEmail(email, name);

    res.status(201).json({
      success: true,
      message: 'Successfully subscribed to newsletter',
      data: {
        email: newSubscriber.email,
        subscriptionDate: newSubscriber.subscriptionDate
      }
    });

  } catch (error) {
    console.error('Newsletter subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Subscription failed. Please try again.'
    });
  }
});

// @POST /api/newsletter/unsubscribe
// Unsubscribe from newsletter
router.post('/unsubscribe', async (req, res) => {
  try {
    const { email, token } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const subscriber = await Newsletter.findOne({ 
      email: email.toLowerCase() 
    });

    if (!subscriber) {
      return res.status(404).json({
        success: false,
        message: 'Subscriber not found'
      });
    }

    // If token provided, verify it
    if (token && subscriber.unsubscribeToken !== token) {
      return res.status(401).json({
        success: false,
        message: 'Invalid unsubscribe token'
      });
    }

    subscriber.isActive = false;
    subscriber.unsubscribedAt = new Date();
    await subscriber.save();

    res.status(200).json({
      success: true,
      message: 'Successfully unsubscribed from newsletter'
    });

  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({
      success: false,
      message: 'Unsubscribe failed'
    });
  }
});

// @GET /api/newsletter/status/:email
// Check subscription status
router.get('/status/:email', async (req, res) => {
  try {
    const { email } = req.params;

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    const subscriber = await Newsletter.findOne({ 
      email: email.toLowerCase() 
    });

    if (!subscriber) {
      return res.status(404).json({
        success: false,
        message: 'Email not subscribed',
        isSubscribed: false
      });
    }

    res.status(200).json({
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

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking subscription status'
    });
  }
});

// @POST /api/newsletter/send-campaign
// Send newsletter campaign (Admin only)
router.post('/send-campaign', async (req, res) => {
  try {
    const { subject, html, userTypes } = req.body;

    // TODO: Add admin authentication check

    if (!subject || !html) {
      return res.status(400).json({
        success: false,
        message: 'Subject and content are required'
      });
    }

    // Find subscribers
    const query = { isActive: true };
    if (userTypes && userTypes.length > 0) {
      query.userType = { $in: userTypes };
    }

    const subscribers = await Newsletter.find(query);

    if (subscribers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No subscribers found'
      });
    }

    // Send emails
    let successCount = 0;
    let failureCount = 0;

    for (const subscriber of subscribers) {
      try {
        const unsubscribeLink = `${process.env.FRONTEND_URL}/newsletter/unsubscribe?email=${subscriber.email}&token=${subscriber.unsubscribeToken}`;
        
        const mailOptions = {
          from: process.env.EMAIL_USER || 'noreply@fairfordpharma.com',
          to: subscriber.email,
          subject: subject,
          html: html + `
            <hr style="margin-top: 40px; border: none; border-top: 1px solid #ddd;">
            <p style="font-size: 12px; color: #888;">
              <a href="${unsubscribeLink}">Unsubscribe from newsletter</a>
            </p>
          `
        };

        await transporter.sendMail(mailOptions);
        successCount++;

        // Update last email sent
        subscriber.lastEmailSent = new Date();
        await subscriber.save();

      } catch (error) {
        console.error(`Error sending email to ${subscriber.email}:`, error);
        failureCount++;
      }
    }

    res.status(200).json({
      success: true,
      message: `Campaign sent: ${successCount} successful, ${failureCount} failed`,
      stats: {
        totalSubscribers: subscribers.length,
        successCount,
        failureCount
      }
    });

  } catch (error) {
    console.error('Campaign send error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending campaign'
    });
  }
});

// @GET /api/newsletter/stats
// Get newsletter statistics (Admin only)
router.get('/stats', async (req, res) => {
  try {
    // TODO: Add admin authentication check

    const totalSubscribers = await Newsletter.countDocuments();
    const activeSubscribers = await Newsletter.countDocuments({ isActive: true });
    const inactiveSubscribers = await Newsletter.countDocuments({ isActive: false });
    
    const byUserType = await Newsletter.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$userType', count: { $sum: 1 } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalSubscribers,
        activeSubscribers,
        inactiveSubscribers,
        byUserType
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics'
    });
  }
});

module.exports = router;