import crypto from "crypto";
import User from "../models/user.model";

const hashCode = (code: string): string => {
  return crypto
    .createHash("sha256")
    .update(code)
    .digest("hex");
};

export const sendVerificationEmail = async (
  userId: string,
  email: string,
  name: string
): Promise<void> => {
  const code = crypto.randomInt(100000, 1000000).toString();

  const hashedCode = hashCode(code);

  const expires = new Date(Date.now() + 10 * 60 * 1000);

  await User.findByIdAndUpdate(userId, {
    verificationCode: hashedCode,
    verificationCodeExpires: expires,
  });

  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.EMAIL_FROM;
  const fromName = process.env.EMAIL_FROM_NAME || "E-Commerce Platform";

  if (!apiKey) {
    throw new Error("BREVO_API_KEY is not configured");
  }

  if (!fromEmail) {
    throw new Error("EMAIL_FROM is not configured");
  }

  const response = await fetch(
    "https://api.brevo.com/v3/smtp/email",
    {
      method: "POST",

      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },

      body: JSON.stringify({
        sender: {
          name: fromName,
          email: fromEmail,
        },

        to: [
          {
            email,
            name,
          },
        ],

        subject: "Verify your email address",

        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
            <h2>Welcome, ${name}!</h2>

            <p>
              Thank you for creating an account with our E-Commerce Platform.
            </p>

            <p>
              Please use the verification code below to verify your email address:
            </p>

            <div style="
              background: #f4f4f4;
              padding: 20px;
              text-align: center;
              font-size: 32px;
              font-weight: bold;
              letter-spacing: 8px;
              margin: 20px 0;
            ">
              ${code}
            </div>

            <p>
              This verification code will expire in
              <strong>10 minutes</strong>.
            </p>

            <p>
              If you did not create this account, you can safely ignore this email.
            </p>
          </div>
        `,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Brevo email failed (${response.status}): ${errorText}`
    );
  }
};
export const sendPasswordResetEmail = async (
  userId: string,
  email: string,
  name: string
): Promise<void> => {
  const code = crypto.randomInt(100000, 1000000).toString();
  const hashedCode = hashCode(code);
  const expires = new Date(Date.now() + 10 * 60 * 1000);

  await User.findByIdAndUpdate(userId, {
    resetPasswordCode: hashedCode,
    resetPasswordExpires: expires,
  });

  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.EMAIL_FROM;
  const fromName = process.env.EMAIL_FROM_NAME || "E-Commerce Platform";

  if (!apiKey || !fromEmail) {
    throw new Error("Email service is not configured");
  }

  const safeName = name.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!
  );

  const response = await fetch(
    "https://api.brevo.com/v3/smtp/email",
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: fromName,
          email: fromEmail,
        },
        to: [
          {
            email,
            name,
          },
        ],
        subject: "Reset your password",
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
            <h2>Password Reset Request</h2>

            <p>Hello ${safeName},</p>

            <p>
              Use the code below to reset your E-Commerce Platform password.
            </p>

            <div style="
              background: #f4f4f4;
              padding: 20px;
              text-align: center;
              font-size: 32px;
              font-weight: bold;
              letter-spacing: 8px;
              margin: 20px 0;
            ">
              ${code}
            </div>

            <p>This code expires in <strong>10 minutes</strong>.</p>

            <p>
              If you did not request a password reset, you can ignore this email.
            </p>
          </div>
        `,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    await User.findByIdAndUpdate(userId, {
      $unset: {
        resetPasswordCode: 1,
        resetPasswordExpires: 1,
      },
    });

    throw new Error(
      `Password reset email failed (${response.status}): ${errorText}`
    );
  }
};