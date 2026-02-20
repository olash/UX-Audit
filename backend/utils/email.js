import { Resend } from 'resend';

// Initialize Resend with your environment variable
const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendAuditCompleteEmail(toEmail, reportUrl) {
    try {
        const data = await resend.emails.send({
            from: 'Abdurrahman at UX Audit <hello@tryuxaudit.com>', // Change to custom domain later
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
            from: 'Abdurrahman at UX Audit <hello@tryuxaudit.com>', // Update when you add a custom domain
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

export const sendLeadMagnetEmail = async (email, source) => {
    try {
        let pdfUrl = '';
        let companyName = '';

        // Match the exact source string we used in the frontend form
        if (source === 'stripe_teardown_pdf') {
            companyName = 'Stripe';
            pdfUrl = 'https://www.tryuxaudit.com/assets/pdfs/stripe-15-page-audit.pdf';
        } else if (source === 'airbnb_teardown_pdf') {
            companyName = 'Airbnb';
            pdfUrl = 'https://www.tryuxaudit.com/assets/pdfs/AirBnB.pdf';
        } else {
            console.log(`Unknown lead source: ${source}`);
            return;
        }

        const html = `
            <div style="font-family: sans-serif; max-width: 580px; margin: 0 auto; color: #1e293b;">
                <h2 style="color: #0f172a;">Here is your complete UX Teardown</h2>
                <p>Hi there,</p>
                <p>Thanks for reading our teardown! As promised, I have attached the full 15-page deep dive into ${companyName}'s design patterns and conversion leaks.</p>

                <p><strong>Want to see how your own website scores?</strong></p>
                <p>You can run a free, automated UX audit on your own site using the exact same AI engine we used for this report.</p>
                <p><a href="https://www.tryuxaudit.com/signup.html" style="color: #2563eb; font-weight: bold;">Run your free UX Audit here &rarr;</a></p>

                <p style="margin-top: 40px; font-size: 14px; color: #64748b;">
                    Best,<br>
                    Abdurrahman at UX Audit
                </p>
            </div>
        `;

        const data = await resend.emails.send({
            from: 'Abdurrahman at UX Audit <hello@tryuxaudit.com>',
            to: email,
            subject: `Your ${companyName} 15-Page UX Audit PDF 📄`,
            html: html,
            attachments: [
                {
                    // Resend fetches the PDF from this URL and attaches it directly to the email
                    filename: `${companyName}_UX_Audit.pdf`,
                    path: pdfUrl
                }
            ]
        });

        console.log(`✅ Lead magnet sent to ${email} for ${companyName}`);
        return data;

    } catch (error) {
        console.error('❌ Error sending lead magnet email:', error);
        throw error;
    }
};

