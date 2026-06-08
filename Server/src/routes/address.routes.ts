import { Router } from "express";
import { AddressController } from "../controllers/address.controller";
import { authMiddleware } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { createAddressSchema, updateAddressSchema } from "../validators/address.validators";

const AddressRouter = Router();

AddressRouter.post("/createAddress", authMiddleware, validate(createAddressSchema), AddressController.create);
AddressRouter.get("/getList", authMiddleware, AddressController.getList);
AddressRouter.get("/getAddressById/:id", authMiddleware, AddressController.getById);
AddressRouter.get("/getAddressesByUserId/:user_id", authMiddleware, AddressController.getByUserId);
AddressRouter.put("/updateAddress/:id", authMiddleware, validate(updateAddressSchema), AddressController.update);
AddressRouter.delete("/deleteAddress/:id", authMiddleware, AddressController.delete);

export default AddressRouter;
