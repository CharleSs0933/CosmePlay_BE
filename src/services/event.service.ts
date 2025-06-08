import { ValidationError } from "../packages/error-handler";

export const validateEventData = (data: any) => {
  const { title, description, start_time, end_time, is_active } = data;

  if (!title || !description || !start_time || !end_time || !is_active) {
    throw new ValidationError("Missing required fields!");
  }
};
