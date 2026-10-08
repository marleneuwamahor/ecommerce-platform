import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/user.model";
import { sendVerificationEmail } from "../services/email.service";

const hashCode = (code: string): string => {
  return crypto
    .createHash("sha256")
    .update(code)
    .digest("hex");
};

export const register = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      res.status(409).json({
        success: false,
        message: "Email is already registered",
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      emailVerified: false,
    });

    try {
      await sendVerificationEmail(
        user._id.toString(),
        user.email,
        user.name
      );
    } catch (emailError) {
      console.error("Verification email error:", emailError);

      await User.findByIdAndDelete(user._id);

      res.status(500).json({
        success: false,
        message: "Account could not be created because verification email failed",
      });
      return;
    }

    res.status(201).json({
      success: true,
      message:
        "Registration successful. Please check your email for the verification code.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to register user",
    });
  }
};

export const verifyEmail = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email, code } = req.body || {};

    if (!email || !code) {
      res.status(400).json({
        success: false,
        message: "Email and verification code are required",
      });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({
      email: normalizedEmail,
    }).select(
      "+verificationCode +verificationCodeExpires"
    );

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    if (user.emailVerified) {
      res.status(400).json({
        success: false,
        message: "Email is already verified",
      });
      return;
    }

    if (
      !user.verificationCode ||
      !user.verificationCodeExpires
    ) {
      res.status(400).json({
        success: false,
        message: "Verification code is not available",
      });
      return;
    }

    if (user.verificationCodeExpires < new Date()) {
      res.status(400).json({
        success: false,
        message: "Verification code has expired",
      });
      return;
    }

    const hashedCode = hashCode(code);

    if (hashedCode !== user.verificationCode) {
      res.status(400).json({
        success: false,
        message: "Invalid verification code",
      });
      return;
    }

    user.emailVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error) {
    console.error("Email verification error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to verify email",
    });
  }
};

export const login = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({
      email: normalizedEmail,
    }).select("+password");

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordCorrect) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    if (!user.emailVerified) {
      res.status(403).json({
        success: false,
        message: "Please verify your email before logging in",
      });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      res.status(500).json({
        success: false,
        message: "JWT secret is not configured",
      });
      return;
    }

    const expiresIn = process.env.JWT_EXPIRES_IN || "1d";

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        role: user.role,
      },
      jwtSecret,
      {
        expiresIn: expiresIn as jwt.SignOptions["expiresIn"],
      }
    );

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to login",
    });
  }
};

export const profile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    res.status(200).json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        emailVerified: req.user.emailVerified,
        createdAt: req.user.createdAt,
        updatedAt: req.user.updatedAt,
      },
    });
  } catch (error) {
    console.error("Profile error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to get profile",
    });
  }
};
export const resendVerification = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email } = req.body || {};

    if (!email) {
      res.status(400).json({
        success: false,
        message: "Email is required",
      });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    if (user.emailVerified) {
      res.status(400).json({
        success: false,
        message: "Email is already verified",
      });
      return;
    }

    await sendVerificationEmail(
      user._id.toString(),
      user.email,
      user.name
    );

    res.status(200).json({
      success: true,
      message: "A new verification code has been sent to your email",
    });
  } catch (error) {
    console.error("Resend verification error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to resend verification email",
    });
  }
};