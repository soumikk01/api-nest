import { baseTemplate, ctaButton, footerNote } from './base.template';

/**
 * Welcome email sent after successful registration.
 * @param name       - user's display name
 * @param dashUrl    - link to the Apio dashboard
 */
export function welcomeTemplate(name: string, dashUrl: string): string {
  const content = `
    <h2 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#fff;letter-spacing:-0.5px;">
      Welcome to Apio, ${name}! 🎉
    </h2>
    <p style="margin:0 0 24px;font-size:14px;color:#8b8ba7;line-height:1.7;">
      Your account is ready. You can now start monitoring your APIs in real time,
      set up alerts, and track performance across all your services.
    </p>

    <!-- Feature highlights -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      ${featureRow('📡', 'Real-time monitoring', 'Track every API request as it happens.')}
      ${featureRow('🔔', 'Instant alerts', 'Get notified the moment something breaks.')}
      ${featureRow('📊', 'Analytics dashboard', 'Understand trends across all your endpoints.')}
    </table>

    ${ctaButton('Go to Dashboard', dashUrl)}

    ${footerNote('You\'re receiving this email because you just created an Apio account. If this wasn\'t you, please contact us at <a href="mailto:support@apio.one" style="color:#6366f1;text-decoration:none;">support@apio.one</a>.')}
  `;

  return baseTemplate(content);
}

function featureRow(icon: string, title: string, desc: string): string {
  return `
    <tr>
      <td style="padding:8px 0;vertical-align:top;width:36px;font-size:18px;">${icon}</td>
      <td style="padding:8px 0 8px 10px;vertical-align:top;">
        <strong style="font-size:14px;color:#fff;display:block;margin-bottom:2px;">${title}</strong>
        <span style="font-size:13px;color:#8b8ba7;">${desc}</span>
      </td>
    </tr>`;
}
