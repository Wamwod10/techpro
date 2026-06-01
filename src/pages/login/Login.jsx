import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiLock, FiUser } from "react-icons/fi";

import { useAuth } from "../../context/AuthContext";

import "./login.scss";

function Login() {
  const navigate = useNavigate();

  const { login } = useAuth();

  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });

  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    const result = await login(formData.username, formData.password);

    if (!result.success) {
      setError(result.message);
      return;
    }

    navigate(result.user.role === "cashier" ? "/sales" : "/");
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>TECHPRO</h1>

        <p>Tizimga kirish</p>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="login-input">
            <FiUser />

            <input
              type="text"
              placeholder="Login"
              value={formData.username}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  username: e.target.value,
                })
              }
            />
          </div>

          <div className="login-input">
            <FiLock />

            <input
              type="password"
              placeholder="Parol"
              value={formData.password}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  password: e.target.value,
                })
              }
            />
          </div>

          <button type="submit">Kirish</button>
        </form>

        <div className="login-hint">
          <span>Admin: admin / 1234</span>
          <span>Sotuvchi 1: sotuvchi1 / 1111</span>
          <span>Sotuvchi 2: sotuvchi2 / 2222</span>
        </div>
      </div>
    </div>
  );
}

export default Login;
