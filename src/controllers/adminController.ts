import { Request, Response, NextFunction } from "express";
import { listRoles } from "../services/userService";

export async function getRoles(
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  const roles = await listRoles();
  return res.status(200).json({ roles });
}

export default { getRoles };
