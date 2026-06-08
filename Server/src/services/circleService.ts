import { DBconnection } from "../config/DBConnect";

export const findCircleByLocation = async (
  longitude: number,
  latitude: number
) => {
  const { data, error } = await DBconnection.rpc(
    "find_circle_by_location",
    {
      user_long: longitude,
      user_lat: latitude,
    }
  );

  if (error) throw new Error(error.message);

  return data && data.length > 0 ? data[0] : null;
};