import type { Request, Express } from "express";

export type RequestWithCookies = Request & {
  cookies?: Record<string, unknown>;
};

export type RequestWithFile = Request & { file?: Express.Multer.File };

export type RequestWithBody<T> = Request<unknown, unknown, T, unknown>;
