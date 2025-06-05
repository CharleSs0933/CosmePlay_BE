import { ValidationError } from "../packages/error-handler";

export const validateAddressData = (data: any) => {
  const { address, city, pincode, phone } = data;

  if (!address || !city || !pincode || !phone) {
    throw new ValidationError("Missing required fields!");
  }
};
