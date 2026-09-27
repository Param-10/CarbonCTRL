/** Send a reset link only through the account owner's email inbox. */
export async function sendPasswordResetEmail(email, resetUrl) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESET_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new Error('Password reset email is not configured');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Reset your CarbonCTRL password',
      text: `Use this link to reset your CarbonCTRL password. It expires in one hour:\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Password reset email provider returned ${response.status}`);
  }
}
