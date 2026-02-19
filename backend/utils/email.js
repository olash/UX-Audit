import { Resend } from 'resend';

// Initialize Resend with your environment variable
const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendAuditCompleteEmail(toEmail, reportUrl) {
    try {
        const data = await resend.emails.send({
            from: 'UX Audit <onboarding@resend.dev>', // Change to custom domain later
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
