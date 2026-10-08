import nodemailer from "nodemailer";
import crypto from "crypto";
import User from "../models/user.model";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

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

  await transporter.sendMail({
    from: `"E-Commerce Platform" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Verify your email address",
    html: `
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
          This verification code will expire in <strong>10 minutes</strong>.
        </p>

        <p>
          If you did not create this account, you can safely ignore this email.
        </p>
      </div>
    `,
  });
};