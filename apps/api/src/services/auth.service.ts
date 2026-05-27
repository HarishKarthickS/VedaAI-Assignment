import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  loginSchema,
  signupSchema,
  updateProfileSchema,
  updateWorkspaceSchema,
  type WorkspaceRole,
} from "@veda/contracts";
import { env } from "../config/env.js";
import { Invite, Membership, RefreshSession, User, Workspace } from "../models/index.js";
import { ApiError } from "../utils/http.js";

type SessionClaims = {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
};

const accessCookie = "veda_access";
const refreshCookie = "veda_refresh";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "none" as const,
    path: "/",
    maxAge,
  };
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as SessionClaims;
}

function issueAccessToken(claims: SessionClaims) {
  return jwt.sign(claims, env.JWT_ACCESS_SECRET, { expiresIn: "7d" });
}

async function issueSession(claims: SessionClaims) {
  const refreshToken = jwt.sign(claims, env.JWT_REFRESH_SECRET, { expiresIn: "30d" });
  await RefreshSession.create({
    userId: claims.userId,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  return {
    accessToken: issueAccessToken(claims),
    refreshToken,
  };
}

async function sessionView(userId: string, workspaceId: string, role: WorkspaceRole) {
  const [user, workspace] = await Promise.all([
    User.findById(userId).select("name email avatar").lean(),
    Workspace.findById(workspaceId).select("name city").lean(),
  ]);
  if (!user || !workspace) throw new ApiError(401, "Your session is no longer available.");
  return { user, workspace, role };
}

export async function signup(input: unknown) {
  const details = signupSchema.parse(input);
  if (await User.exists({ email: details.email })) {
    throw new ApiError(409, "An account with that email already exists.");
  }

  let userId: string | undefined;
  let workspaceId: string | undefined;

  try {
    const user = await User.create({
      name: details.name,
      email: details.email,
      passwordHash: await bcrypt.hash(details.password, 12),
    });
    userId = String(user._id);

    const workspace = await Workspace.create({
      name: details.schoolName,
      city: details.city,
      createdBy: user._id,
    });
    workspaceId = String(workspace._id);

    await Membership.create({
      userId: user._id,
      workspaceId: workspace._id,
      role: "ADMIN",
    });
  } catch (error) {
    // Local Docker Mongo runs as a standalone server, so signup avoids transactions and cleans up explicitly.
    if (workspaceId) {
      await Promise.allSettled([
        Membership.deleteMany({ workspaceId }),
        Workspace.deleteOne({ _id: workspaceId }),
      ]);
    }
    if (userId) {
      await RefreshSession.deleteMany({ userId });
      await User.deleteOne({ _id: userId });
    }
    throw error;
  }

  if (!userId || !workspaceId) throw new ApiError(500, "Account creation could not be completed.");
  const claims: SessionClaims = { userId, workspaceId, role: "ADMIN" };
  const tokens = await issueSession(claims);
  return { ...(await sessionView(claims.userId, claims.workspaceId, claims.role)), tokens };
}

export async function login(input: unknown) {
  const details = loginSchema.parse(input);
  const user = await User.findOne({ email: details.email });
  if (!user || !(await bcrypt.compare(details.password, user.passwordHash))) {
    throw new ApiError(401, "Email or password is incorrect.");
  }
  const membership = await Membership.findOne({ userId: user._id });
  if (!membership) throw new ApiError(403, "This account does not belong to a workspace.");

  const claims: SessionClaims = {
    userId: String(user._id),
    workspaceId: String(membership.workspaceId),
    role: membership.role as WorkspaceRole,
  };
  const tokens = await issueSession(claims);
  return { ...(await sessionView(claims.userId, claims.workspaceId, claims.role)), tokens };
}

export async function refreshSession(refreshToken: string | undefined) {
  if (!refreshToken) throw new ApiError(401, "Please sign in.");
  const claims = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as SessionClaims;
  const stored = await RefreshSession.findOne({ tokenHash: hashToken(refreshToken), revokedAt: null });
  if (!stored || stored.expiresAt < new Date()) throw new ApiError(401, "Please sign in again.");

  stored.revokedAt = new Date();
  await stored.save();
  const tokens = await issueSession(claims);
  return { ...(await sessionView(claims.userId, claims.workspaceId, claims.role)), tokens };
}

export async function logout(refreshToken: string | undefined) {
  if (refreshToken) {
    await RefreshSession.updateOne({ tokenHash: hashToken(refreshToken) }, { revokedAt: new Date() });
  }
}

export async function createInvite(claims: SessionClaims, input: { email?: string }) {
  if (claims.role !== "ADMIN") throw new ApiError(403, "Only administrators can invite teachers.");
  const token = randomBytes(24).toString("hex");
  const invite = await Invite.create({
    workspaceId: claims.workspaceId,
    email: input.email,
    role: "TEACHER",
    tokenHash: hashToken(token),
    createdBy: claims.userId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  return { id: invite.id, token, expiresAt: invite.expiresAt };
}

export async function acceptInvite(token: string, input: unknown) {
  const details = signupSchema.omit({ schoolName: true, city: true }).parse(input);
  const invite = await Invite.findOne({ tokenHash: hashToken(token), acceptedAt: null });
  if (!invite || invite.expiresAt < new Date()) throw new ApiError(404, "This invitation has expired.");
  if (invite.email && invite.email !== details.email) {
    throw new ApiError(403, "This invitation was sent to another email address.");
  }
  if (await User.exists({ email: details.email })) throw new ApiError(409, "Sign in to join this workspace.");

  const user = await User.create({
    name: details.name,
    email: details.email,
    passwordHash: await bcrypt.hash(details.password, 12),
  });
  await Membership.create({ workspaceId: invite.workspaceId, userId: user._id, role: invite.role });
  invite.acceptedAt = new Date();
  await invite.save();

  const claims = {
    userId: String(user._id),
    workspaceId: String(invite.workspaceId),
    role: invite.role as WorkspaceRole,
  };
  const tokens = await issueSession(claims);
  return { ...(await sessionView(claims.userId, claims.workspaceId, claims.role)), tokens };
}

export async function listMembers(workspaceId: string) {
  const memberships = await Membership.find({ workspaceId }).populate("userId", "name email avatar").lean();
  return memberships.map((membership) => ({
    id: String(membership._id),
    role: membership.role,
    user: membership.userId,
  }));
}

export async function updateProfile(claims: SessionClaims, input: unknown) {
  const values = updateProfileSchema.parse(input);
  const user = await User.findById(claims.userId);
  if (!user) throw new ApiError(404, "Profile not found.");
  user.name = values.name;
  user.avatar = values.avatar || undefined;
  await user.save();
  return sessionView(claims.userId, claims.workspaceId, claims.role);
}

export async function updateWorkspace(claims: SessionClaims, input: unknown) {
  if (claims.role !== "ADMIN") throw new ApiError(403, "Only administrators can update school settings.");
  const values = updateWorkspaceSchema.parse(input);
  const workspace = await Workspace.findById(claims.workspaceId);
  if (!workspace) throw new ApiError(404, "School workspace not found.");
  workspace.name = values.name;
  workspace.city = values.city;
  await workspace.save();
  return sessionView(claims.userId, claims.workspaceId, claims.role);
}

