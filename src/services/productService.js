import axios from "axios";

const API = "http://localhost:5000/api/products";

export const getProducts = async () => {
  const response = await axios.get(API);

  return response.data;
};