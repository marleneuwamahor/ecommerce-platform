import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: "user" | "admin";

  emailVerified: boolean;
  verificationCode?: string;
  verificationCodeExpires?: Date;

  resetPasswordCode?: string;
  resetPasswordExpires?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    emailVerified: {
      type: Boolean,
      default: false,
    },

    verificationCode: {
      type: String,
      select: false,
    },

    verificationCodeExpires: {
      type: Date,
      select: false,
    },

    resetPasswordCode: {
      type: String,
      select: false,
    },

    resetPasswordExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model<IUser>("User", userSchema);

export default User;