import type { Request } from "express";

export type RequestWithCookies = Request & {
  cookies?: Record<string, unknown>;
};

export type RequestWithFile = Request & { file?: Request["file"] };

export type RequestWithBody<T> = Request<unknown, unknown, T, unknown>;
