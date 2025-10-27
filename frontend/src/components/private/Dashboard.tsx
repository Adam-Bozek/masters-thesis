"use client";

import withAuth from "../../utilities/WithAuth";
import { useAuth } from "../../utilities/AuthContext";

const Dashboard = () => {
  const { logout } = useAuth();
  return (
    <div>
      <h2>Dashboard</h2>
      <p>Welcome</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

export default withAuth(Dashboard);
