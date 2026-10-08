import { ApiError } from "../utils/apiError";
import * as userRepository from "../repositories/user.repository";
import { SafeUser, toSafeUser } from "./auth.service";
import { UpdateMeInput } from "../validators/user.validator";

export async function getMe(userId: string): Promise<SafeUser> {
  const user = await userRepository.findUserById(userId);
  if (!user) {
    throw ApiError.notFound("User not found");
  }
  return toSafeUser(user);
}

export async function updateMe(userId: string, input: UpdateMeInput): Promise<SafeUser> {
  const user = await userRepository.updateUser(userId, input);
  return toSafeUser(user);
}
