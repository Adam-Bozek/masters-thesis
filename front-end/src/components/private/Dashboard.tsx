import withAuth from "../../utilities/WithAuth";
import { useAuth } from "../../utilities/AuthContext";

const Dashboard = () => {
  const { user, logout } = useAuth();

  return (
    <div>
      <h2>Dashboard</h2>
      <p>Welcome, User ID: {user}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

export default withAuth(Dashboard);
