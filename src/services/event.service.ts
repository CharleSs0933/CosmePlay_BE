export const validateEventData = (data: any) => {
  const { title, description, start_date, end_date, is_active } = data;

  if (!title || !description || !start_date || !end_date || !is_active) {
    throw new Error("Missing required fields!");
  }
};
