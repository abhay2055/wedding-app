import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { sendSuccess } from "../utils/apiResponse";
import { ApiError } from "../utils/apiError";
import * as conversationService from "../services/conversation.service";
import * as messageService from "../services/message.service";
import { ListMessagesQuery } from "../validators/conversation.validator";

export const listConversations = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const conversations = await conversationService.listMyConversations(req.user.id, req.user.role);
  sendSuccess(res, { conversations });
});

export const createConversation = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const conversation = await conversationService.getOrCreateConversation(req.user.id, req.user.role, req.body);
  sendSuccess(res, { conversation }, 201);
});

export const getConversation = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const conversation = await conversationService.getConversation(req.user.id, req.user.role, req.params.id);
  sendSuccess(res, { conversation });
});

export const listMessages = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const { page, limit } = req.query as unknown as ListMessagesQuery;
  const result = await messageService.listMessages(req.user.id, req.user.role, req.params.id, page, limit);
  sendSuccess(res, result);
});

export const sendMessage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  const message = await messageService.sendMessage(req.user.id, req.user.role, req.params.id, req.body);
  sendSuccess(res, { message }, 201);
});

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized();
  await messageService.markConversationRead(req.user.id, req.user.role, req.params.id);
  sendSuccess(res, { read: true });
});
