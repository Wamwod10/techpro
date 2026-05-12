export const formatPrice = (price) => {
  return (
    Number(price)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " so‘m"
  );
};
