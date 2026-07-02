import { Router } from "express";
import {
  register,
  login,
  getList,
  getUserById,
  updateUser,
  updateStatus,
  deleteUser,
  changePassword,
  updateOwnProfile,
  validateOTP,
  forgotPasswordController,
  verifyForgotPasswordOtp,
  updatePasswordController,
  getUsersByRole,
  getUsersByStoreAdmin,
  getUsersBySuperAdmin,
  getUsersBySubAdmin,
  sendLoginOtp,
  verifyLoginOtp,
  updateAccountStatus,
  sendOtpForForgotIdentifier,
  validateOtpForForgotIdentifier,
  refreshTokenController,
  resendOtp,
  getMyMenu,
  getUserStats,
  googleLogin,
} from "../controllers/user.controller";
import { authMiddleware, optionalAuthMiddlewares, requireRole, requirePermission } from "../middleware/auth";
import { memoryUploader } from "../middleware/upload";
import { validate } from "../middleware/validate";
import {
  registerSchema,
  loginSchema,
  sendLoginOtpSchema,
  validateOTPSchema,
  forgotPasswordSchema,
  verifyForgotPasswordOtpSchema,
  updatePasswordSchema,
  updateUserSchema,
  changePasswordSchema,
  sendForgotIdentifierOtpSchema,
  validateForgotIdentifierOtpSchema,
  verifyLoginOtpSchema,
  resendOtpSchema,
} from "../validators/user.validators";

const UserRouter = Router();

UserRouter.post("/register", optionalAuthMiddlewares,memoryUploader.array("images", 5),validate(registerSchema),register);

UserRouter.post("/login", validate(loginSchema), login);
UserRouter.post("/google", googleLogin);
UserRouter.post("/send-login-otp", validate(sendLoginOtpSchema), sendLoginOtp);
UserRouter.post("/verify-login-otp", validate(verifyLoginOtpSchema), verifyLoginOtp);
UserRouter.post("/refresh-token", refreshTokenController);
UserRouter.get("/my-menu", authMiddleware, getMyMenu);

UserRouter.get("/stats", authMiddleware, requirePermission('Users', 'view'), getUserStats);
UserRouter.get("/getList", authMiddleware, requirePermission('Users', 'view'), getList);
UserRouter.get("/getallusers/superadmin/:superadminId", authMiddleware, requirePermission('Users', 'view'), getUsersBySuperAdmin);
UserRouter.get("/getallusers/subadmin/:subAdminId", authMiddleware, requirePermission('Users', 'view'), getUsersBySubAdmin);
UserRouter.get("/getallusers/store-admin/:storeAdminId", authMiddleware, requirePermission('Users', 'view'), getUsersByStoreAdmin);
UserRouter.get("/getallusers/:id", authMiddleware, requirePermission('Users', 'view'), getUserById);

UserRouter.get("/getallusers/role/:roleId", authMiddleware, requirePermission('Users', 'view'), getUsersByRole);

UserRouter.put("/updateuser/:id",authMiddleware,requireRole("Admin", "SuperAdmin", "SubAdmin", "StoreAdmin"),requirePermission('Users', 'edit'),memoryUploader.array("images", 5),validate(updateUserSchema),updateUser);
UserRouter.put("/profile/:id", authMiddleware, memoryUploader.array("images", 1), updateOwnProfile);

UserRouter.delete("/deleteuser/:id", authMiddleware, requireRole("Admin", "SuperAdmin", "SubAdmin", "StoreAdmin"), requirePermission('Users', 'delete'), deleteUser);
UserRouter.patch("/status/:id", authMiddleware, requireRole("Admin", "SuperAdmin", "SubAdmin", "StoreAdmin"), requirePermission('Users', 'edit'), updateStatus);
UserRouter.patch("/account-status/:id", authMiddleware, requireRole("Admin", "SuperAdmin", "SubAdmin", "StoreAdmin"), requirePermission('Users', 'edit'), updateAccountStatus);
UserRouter.put("/change-password/:id", authMiddleware, validate(changePasswordSchema), changePassword);
UserRouter.post("/validateOTP", validate(validateOTPSchema), validateOTP);
UserRouter.post("/forgot-password", validate(forgotPasswordSchema), forgotPasswordController);
UserRouter.post("/forgot-password/verify-otp", validate(verifyForgotPasswordOtpSchema), verifyForgotPasswordOtp);
UserRouter.post("/update-password", validate(updatePasswordSchema), updatePasswordController);
UserRouter.post("/resend-otp", validate(resendOtpSchema), resendOtp);
UserRouter.post("/forgot-identifier/send-otp", validate(sendForgotIdentifierOtpSchema), sendOtpForForgotIdentifier);
UserRouter.post("/forgot-identifier/validate-otp", validate(validateForgotIdentifierOtpSchema), validateOtpForForgotIdentifier);

export default UserRouter;
