export const LOCAL_USERS = [
  {
    username: "admin",
    password: "1234",
    role: "admin",
    name: "Administrator",
  },
  {
    username: "sotuvchi1",
    password: "1111",
    role: "cashier",
    name: "Sotuvchi 1",
  },
  {
    username: "sotuvchi2",
    password: "2222",
    role: "cashier",
    name: "Sotuvchi 2",
  },
];

export const toSessionUser = (user) => ({
  id: user.username,
  username: user.username,
  role: user.role,
  name: user.name,
});
