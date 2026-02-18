
export function renderReportHTML(data) {
    const { project, pages, issues, breakdown } = data;
    const coverDate = new Date(project.created_at).toLocaleDateString();

    // Process breakdown for styling
    const breakdownHTML = Object.entries(breakdown).map(([key, val]) => `
        <div style="margin-bottom: 24px;">
            <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 500; font-family: 'Inter', sans-serif; color: #334155; margin-bottom: 8px; text-transform: capitalize;">
                <span>${key}</span>
                <span>${val}/100</span>
            </div>
            <div style="width: 100%; background-color: #e2e8f0; border-radius: 9999px; height: 12px; overflow: hidden;">
                <div style="background-color: #0f172a; height: 100%; border-radius: 9999px; width: ${val}%;"></div>
            </div>
        </div>
    `).join('');

    // Process Issues
    let issuesHTML = '<p class="text-slate-500 italic">No critical issues found.</p>';
    if (issues && issues.length > 0) {
        issuesHTML = issues.map(issue => {
            const severity = issue.severity || 'Medium';
            let badgeColor = '#f1f5f9'; // slate-100
            let textColor = '#334155'; // slate-700
            if (severity.toLowerCase() === 'critical') {
                badgeColor = '#fee2e2'; // red-100
                textColor = '#991b1b'; // red-800
            } else if (severity.toLowerCase() === 'high') {
                badgeColor = '#ffedd5'; // orange-100
                textColor = '#9a3412'; // orange-800
            }

            return `
            <div style="background-color: #f8fafc; border-radius: 12px; padding: 24px; border: 1px solid #e2e8f0; page-break-inside: avoid; margin-bottom: 24px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                    <h3 style="font-weight: 700; color: #0f172a; font-size: 16px; margin: 0;">${issue.title}</h3>
                    <span style="padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; background-color: ${badgeColor}; color: ${textColor};">${severity}</span>
                </div>
                <p style="font-size: 14px; color: #475569; margin-bottom: 12px; line-height: 1.5;">${issue.description}</p>
                <div style="font-size: 12px; color: #64748b;">
                    Category: <span style="font-weight: 600; color: #334155;">${issue.category || 'General'}</span>
                </div>
            </div>`;
        }).join('');
    }

    // Process Fixes
    const fixes = issues ? issues.filter(i => i.ai_suggestion) : [];
    let fixesHTML = '<p class="text-slate-500 italic">No suggestions available.</p>';
    if (fixes.length > 0) {
        fixesHTML = fixes.map(fix => `
            <div style="display: flex; gap: 16px; padding: 24px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; page-break-inside: avoid; margin-bottom: 24px;">
                <div style="flex-shrink: 0; padding-top: 4px;">
                     <!-- Lightbulb Icon SVG -->
                     <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-1 1.5-2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>
                </div>
                <div>
                    <h4 style="font-weight: 700; color: #0f172a; font-size: 14px; margin: 0 0 4px 0;">${fix.title}</h4>
                    <p style="font-size: 14px; color: #475569; margin: 0; line-height: 1.5;">${fix.ai_suggestion}</p>
                </div>
            </div>
        `).join('');
    }

    // Process Screenshots
    let screenshotsHTML = '';
    if (pages && pages.length > 0) {
        screenshotsHTML = pages.filter(p => p.screenshot_url).map(page => `
            <div style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #f8fafc; page-break-inside: avoid;">
                <img src="${page.screenshot_url}" style="width: 100%; height: 200px; object-fit: cover; object-position: top;">
                <div style="padding: 12px; border-top: 1px solid #e2e8f0; background-color: #ffffff;">
                    <p style="font-size: 12px; text-align: center; font-weight: 500; color: #475569; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${new URL(page.url).pathname}</p>
                </div>
            </div>
        `).join('');
    }

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>UX Audit Report</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 48px; color: #0f172a; max-width: 900px; margin: 0 auto; }
        .page-break { page-break-before: always; }
        h1 { font-size: 48px; font-weight: 700; margin-bottom: 16px; letter-spacing: -0.025em; }
        h2 { font-size: 24px; font-weight: 700; margin-bottom: 24px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; }
        .cover-container { height: 900px; display: flex; flex-direction: column; justify-content: space-between; margin-bottom: 48px; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    </style>
</head>
<body>
    <!-- Cover Page -->
    <div class="cover-container">
        <div style="margin-top: 80px;">
            <div style="margin-bottom: 32px;">
                ${data.logoBase64
            ? `<img src="${data.logoBase64}" style="height: 48px; width: auto; object-fit: contain;">`
            : `<div style="display: inline-flex; align-items: center; justify-content: center; width: 64px; height: 64px; border-radius: 16px; background-color: #0f172a; color: white;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 22h2a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h2"/><path d="M12 6V4"/><path d="M12 10v-2"/><path d="M12 14v-2"/><path d="M12 18v-2"/><path d="M12 22v-2"/><path d="m9 8 3 3 3-3"/><path d="m9 16 3 3 3-3"/></svg>
                       </div>`
        }
            </div>
            <h1>UX Audit Report</h1>
            <p style="font-size: 20px; color: #64748b; font-weight: 500; margin: 0;">${project.target_url}</p>
        </div>
        
        <div style="border-top: 1px solid #f1f5f9; padding-top: 32px; display: flex; justify-content: space-between; align-items: flex-end;">
            <div>
                <p style="font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin: 0 0 4px 0;">Generated On</p>
                <p style="font-size: 18px; font-weight: 500;">${coverDate}</p>
            </div>
            <div style="text-align: right;">
                <p style="font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; margin: 0 0 4px 0;">Overall Score</p>
                <p style="font-size: 48px; font-weight: 700; margin: 0;">${project.score || '--'}</p>
            </div>
        </div>
    </div>

    <div class="page-break"></div>

    <!-- Breakdown -->
    <div style="margin-bottom: 48px; page-break-inside: avoid;">
        <h2>Score Breakdown</h2>
        <div style="background-color: #f8fafc; border-radius: 16px; padding: 32px; border: 1px solid #f1f5f9;">
            <div style="display: grid; gap: 24px;">
                ${breakdownHTML}
            </div>
        </div>
    </div>

    <!-- Identified Issues -->
    <div style="margin-bottom: 48px;">
        <h2>Identified Issues</h2>
        <div>${issuesHTML}</div>
    </div>

    <div class="page-break"></div>

    <!-- Suggested Fixes -->
    <div style="margin-bottom: 48px;">
        <h2>Suggested Fixes</h2>
        <div>${fixesHTML}</div>
    </div>

    <!-- Screenshots -->
    <div style="margin-bottom: 48px;">
        <h2>Screenshots Captured</h2>
        <div class="grid-2">
            ${screenshotsHTML}
        </div>
    </div>

    <!-- Footer -->
    <div style="margin-top: 80px; padding-top: 32px; border-top: 1px solid #f1f5f9; text-align: center; color: #94a3b8; font-size: 14px;">
        <p>Generated by UX Audit Platform</p>
    </div>
</body>
</html>
    `;
}
