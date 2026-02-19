import { Resend } from 'resend';

// Initialize Resend with your environment variable
const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendAuditCompleteEmail(toEmail, reportUrl) {
    try {
        const data = await resend.emails.send({
            from: 'UX Audit <hello@tryuxaudit.com>', // Change to custom domain later
            to: [toEmail],
            subject: 'Your UX Audit Report is Ready! 🎉',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Great news!</h2>
                    <p>Your automated UX audit has finished processing.</p>
                    <p>We've analyzed your pages, calculated your scores, and generated your final report.</p>
                    <a href="${reportUrl}" style="display: inline-block; padding: 12px 24px; background-color: #000; color: #fff; text-decoration: none; border-radius: 6px; margin-top: 15px;">View & Download PDF</a>
                </div>
            `,
        });
        console.log("✅ Email sent successfully:", data.id);
    } catch (error) {
        console.error("❌ Failed to send email:", error);
    }
}

export async function sendWelcomeEmail(toEmail) {
    try {
        const data = await resend.emails.send({
            from: 'UX Audit <hello@tryuxaudit.com>', // Update when you add a custom domain
            to: [toEmail],
            subject: 'Welcome to UX Audit! 🎉',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2>Welcome to UX Audit!</h2>
                    <p>We're thrilled to have you on board.</p>
                    <p>Ready to start improving your websites? You can now run your first AI-powered UX audit and generate actionable insights in seconds.</p>
                    <a href="https://tryuxaudit.com/dashboard.html" style="display: inline-block; padding: 12px 24px; background-color: #000; color: #fff; text-decoration: none; border-radius: 6px; margin-top: 15px;">Go to Dashboard</a>
                </div>
            `,
        });
        console.log("✅ Welcome Email sent successfully:", data.id);
    } catch (error) {
        console.error("❌ Failed to send welcome email:", error);
    }
}
