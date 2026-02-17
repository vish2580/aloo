const nodemailer = require('nodemailer');

/**
 * Email Service using Nodemailer with Brevo SMTP
 * 
 * Handles sending password reset emails and other notifications
 */

class EmailService {
    constructor() {
        // Configure SMTP transport using Brevo
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT),
            secure: false, // Use TLS
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        console.log('[EMAIL] Email service initialized with Brevo SMTP');
    }

    /**
     * Send password reset email
     * @param {string} email - Recipient email address
     * @param {string} resetToken - Raw reset token (not hashed)
     * @returns {Promise<void>}
     */
    async sendPasswordResetEmail(email, resetToken) {
        try {
            const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
            const expiryMinutes = process.env.RESET_TOKEN_EXPIRE_MINUTES || 15;

            const mailOptions = {
                from: `"LuxWin Support" <${process.env.SMTP_USER}>`,
                to: email,
                subject: 'Password Reset Request - LuxWin',
                html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                background-color: #f4f4f4;
                margin: 0;
                padding: 0;
              }
              .container {
                max-width: 600px;
                margin: 20px auto;
                background-color: #ffffff;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
              .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: #ffffff;
                padding: 30px 20px;
                text-align: center;
              }
              .header h1 {
                margin: 0;
                font-size: 24px;
              }
              .content {
                padding: 30px 20px;
              }
              .content p {
                margin: 0 0 15px 0;
              }
              .button {
                display: inline-block;
                padding: 12px 30px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: #ffffff !important;
                text-decoration: none;
                border-radius: 5px;
                font-weight: bold;
                margin: 20px 0;
              }
              .button:hover {
                opacity: 0.9;
              }
              .warning {
                background-color: #fff3cd;
                border-left: 4px solid #ffc107;
                padding: 12px;
                margin: 20px 0;
                border-radius: 4px;
              }
              .footer {
                background-color: #f8f9fa;
                padding: 20px;
                text-align: center;
                font-size: 12px;
                color: #6c757d;
              }
              .code-box {
                background-color: #f8f9fa;
                border: 1px solid #dee2e6;
                border-radius: 4px;
                padding: 10px;
                font-family: monospace;
                word-break: break-all;
                margin: 15px 0;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🔐 Password Reset Request</h1>
              </div>
              <div class="content">
                <p>Hello,</p>
                <p>We received a request to reset your password for your LuxWin account.</p>
                <p>Click the button below to reset your password:</p>
                
                <div style="text-align: center;">
                  <a href="${resetUrl}" class="button">Reset Password</a>
                </div>

                <p>Or copy and paste this link into your browser:</p>
                <div class="code-box">${resetUrl}</div>

                <div class="warning">
                  <strong>⚠️ Important:</strong> This link will expire in <strong>${expiryMinutes} minutes</strong>.
                </div>

                <p><strong>If you didn't request this password reset, please ignore this email.</strong> Your password will remain unchanged.</p>

                <p>For security reasons:</p>
                <ul>
                  <li>Never share this link with anyone</li>
                  <li>Our team will never ask for your password</li>
                  <li>Always verify the URL before entering credentials</li>
                </ul>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} LuxWin. All rights reserved.</p>
                <p>This is an automated email. Please do not reply to this message.</p>
              </div>
            </div>
          </body>
          </html>
        `,
                text: `
Password Reset Request

Hello,

We received a request to reset your password for your LuxWin account.

Click the link below to reset your password:
${resetUrl}

This link will expire in ${expiryMinutes} minutes.

If you didn't request this password reset, please ignore this email. Your password will remain unchanged.

For security reasons:
- Never share this link with anyone
- Our team will never ask for your password
- Always verify the URL before entering credentials

© ${new Date().getFullYear()} LuxWin. All rights reserved.
        `
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log(`[EMAIL] ✅ Password reset email sent to ${email} - Message ID: ${info.messageId}`);

            return info;
        } catch (error) {
            console.error(`[EMAIL] ❌ Failed to send password reset email to ${email}:`, error.message);
            throw new Error('Failed to send password reset email');
        }
    }

    /**
     * Verify SMTP connection
     * @returns {Promise<boolean>}
     */
    async verifyConnection() {
        try {
            await this.transporter.verify();
            console.log('[EMAIL] ✅ SMTP connection verified');
            return true;
        } catch (error) {
            console.error('[EMAIL] ❌ SMTP connection failed:', error.message);
            return false;
        }
    }
}

// Export singleton instance
module.exports = new EmailService();
