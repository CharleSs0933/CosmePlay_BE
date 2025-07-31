import { ValidationError } from "../packages/error-handler";

export const validateAddressData = (data: any) => {
  const { address, city, pincode, phone, full_name } = data;

  if (!address || !city || !pincode || !phone || !full_name) {
    throw new ValidationError("Missing required fields!");
  }
};
