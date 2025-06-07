// services/email.js
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendBookingConfirmationEmail(to, bookingCode, data) {
  const {
    clientName,
    trekName,
    trekDate,
    ratePerPerson,
    groupSize,
    advancePaid,
    sharingType,
    paymentMode,
    specialNotes,
    senderName = 'Admin',
    voucher // { code: string, amount: number }
  } = data;

  const totalAmount = ratePerPerson * groupSize;
  const balanceAmount = totalAmount - advancePaid;

  const trekDateObj = new Date(trekDate);
  const day = ("0" + trekDateObj.getDate()).slice(-2);
  const month = ("0" + (trekDateObj.getMonth() + 1)).slice(-2);
  const year = trekDateObj.getFullYear();
  const formattedDate = `${day}-${month}-${year}`;

  const voucherNote = voucher?.code
    ? `<p style="font-size:16px; color:#333333;">
        🎟️ Voucher <strong>${voucher.code}</strong> was applied worth ₹${voucher.amount}/-.
      </p>`
    : "";

  const emailHtml = `
    <html>
      <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin:0; padding:0; background-color:#f4f4f4;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 0 10px rgba(0,0,0,0.1);">
                <tr>
                  <td align="center" style="background-color:#003366; padding:20px;">
                    <a href="https://www.discoveryhike.in" target="_blank">
                      <img src="https://i.imgur.com/40sl7Sv.png" alt="" style="width:150px;">
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="background-color:#003366; padding:10px 20px; color:#ffffff;">
                    <h2 style="margin:0; font-size:24px;">Booking Successful</h2>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px;">
                    <p style="font-size:16px; color:#333333;">Dear <strong>${clientName},</strong></p>
                    <p style="font-size:16px; color:#333333;">
                      Your booking for the <span style="color:#FF8C00;"><strong>${trekName}</strong></span> with <strong>Discovery Hike</strong> has been confirmed as you have paid the advance amount.
                    </p>
                    <p style="font-size:16px; color:#333333;">
                      You have chosen the date <span style="color:#FF8C00;"><strong>${formattedDate}</strong></span> and opted for <span style="color:#FF8C00;"><strong>${sharingType}</strong></span> sharing. We will update you with the pick-up point and formality details as soon as possible.
                    </p>
                    ${voucherNote}
                    <p style="font-size:16px; color:#008000; text-shadow: 2px 2px 4px #000000;">
                      Nature Welcomes You When You Have a Welcoming Nature— Let’s Keep the Mountains Clean.
                    </p>
                    <h3 style="color:#003366; border-bottom:2px solid #FF8C00; padding-bottom:5px;">Detailed Overview of your Booking:</h3>
                    <table width="100%" cellpadding="10" cellspacing="0" border="0" style="border-collapse: collapse; margin-top:10px;">
                      <tr><td style="border:1px solid #dddddd; background-color:#f9f9f9; font-weight:bold;">Rate per person</td><td style="border:1px solid #dddddd; text-align:center;">₹${ratePerPerson}/-</td></tr>
                      <tr><td style="border:1px solid #dddddd; background-color:#f9f9f9; font-weight:bold;">Number of people (Pax)</td><td style="border:1px solid #dddddd; text-align:center;">${groupSize}</td></tr>
                      <tr><td style="border:1px solid #dddddd; background-color:#f9f9f9; font-weight:bold;">Advance Paid</td><td style="border:1px solid #dddddd; text-align:center; color:#FF8C00;">₹${advancePaid}/-</td></tr>
                      <tr><td style="border:1px solid #dddddd; background-color:#f9f9f9; font-weight:bold;">Remaining Amount</td><td style="border:1px solid #dddddd; text-align:center; color:#FF8C00;">₹${balanceAmount}/-</td></tr>
                      <tr><td style="border:1px solid #dddddd; background-color:#f9f9f9; font-weight:bold;">Total Amount</td><td style="border:1px solid #dddddd; text-align:center;">₹${totalAmount}/-</td></tr>
                    </table>
                    <h3 style="color:#003366; border-bottom:2px solid #FF8C00; padding-bottom:5px; margin-top:30px;">Cancellation Policy:</h3>
                    <ul style="color:#333333;font-size:16px; line-height:1.5;">
                      <li><strong>To cancel:</strong> Email us at <a href="mailto:info@discoveryhike.in">info@discoveryhike.in</a>.</li>
                      <li><strong>Cancellation due to events:</strong> If cancelled due to natural events, a one-year valid voucher will be issued.</li>
                      <li><strong>Personal cancellations:</strong> 
                        <ul>
                          <li><strong style="color:#FF8C00;">No Cash Refunds.</strong></li>
                          <li>30+ days before: full voucher.</li>
                          <li>20–29 days: 50% voucher.</li>
                          <li>< 20 days: No voucher.</li>
                        </ul>
                      </li>
                    </ul>
                    <h3 style="color:#003366; border-bottom:2px solid #FF8C00; padding-bottom:5px; margin-top:30px;">Important Notes:</h3>
                    <ol style="color:#333333; font-size:16px; line-height:1.5;">
                      <li>Pay full amount only at pickup.</li>
                      <li>Carry valid ID (original + attested copy).</li>
                      <li>No meals during transport; driver may stop on request.</li>
                      <li>Watch out for fraud.</li>
                      <li>Pickup details shared ~6 hours before trek.</li>
                      <li>Email <a href="mailto:info@discoveryhike.in">info@discoveryhike.in</a> for queries.</li>
                    </ol>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px; background-color:#003366; color:#ffffff;">
                    <p style="margin:0;">Best regards,</p>
                    <p style="margin:0;"><strong>${senderName}</strong><br>Team, Discovery Hike</p>
                    <br>
                    <table cellpadding="0" cellspacing="0" border="0" align="left" style="margin-bottom: 10px;">
                      <tr>
                        <td style="padding:0 10px;"><a href="https://www.facebook.com/discoveryhike"><img src="https://i.imgur.com/sJ0PSEI.png" style="width:30px;"></a></td>
                        <td style="padding:0 10px;"><a href="https://www.youtube.com/@DiscoveryHike"><img src="https://i.imgur.com/QyXYNIj.png" style="width:30px;"></a></td>
                        <td style="padding:0 10px;"><a href="https://www.instagram.com/discoveryhike"><img src="https://i.imgur.com/mi27Dqd.png" style="width:30px;"></a></td>
                        <td style="padding:0 10px;"><a href="https://wa.me/919458118063"><img src="https://i.imgur.com/7P9C5Nq.png" style="width:30px;"></a></td>
                      </tr>
                    </table>
                    <br style="clear:both;">
                    <p style="font-size:14px; margin:0;">&copy; ${new Date().getFullYear()} Discovery Hike. All rights reserved.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>`;

  try {
    const { error } = await resend.emails.send({
      from: process.env.RESEND_VERIFIED_FROM_EMAIL || 'Discovery Hike <no-reply@discoveryhikes.in>',
      to,
      subject: `Booking Confirmation - ${trekName} with Discovery Hike`,
      html: emailHtml
    });

    if (error) {
      console.error("❌ Email send failed:", error.message);
      throw new Error("Email confirmation failed: " + error.message);
    }
  } catch (err) {
    console.error("❌ Email error:", err.message);
    throw err;
  }
}
