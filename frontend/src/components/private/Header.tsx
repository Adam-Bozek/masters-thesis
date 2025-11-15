"use client";

import "bootstrap/dist/css/bootstrap.min.css";
import { Navbar, Button } from "react-bootstrap";
import { useAuth } from "@/utilities/AuthContext";

const Header = () => {
  const { user, logout } = useAuth();

  return (
    <header className="container my-4">
      <div className="glass w-100">
        <Navbar expand="md" className="py-3 px-3 mx-4">
          {/* Left: greeting / brand */}
          <Navbar.Brand className="me-auto">
            <h1 className="h3 m-0">Zdravíme {user?.firstName}!</h1>
          </Navbar.Brand>

          {/* Burger – visible only on < md automatically */}
          <Navbar.Toggle aria-controls="main-navbar" />

          {/* Collapsible area: same buttons for mobile & desktop */}
          <Navbar.Collapse id="main-navbar" className="justify-content-md-end">
            <div className="d-flex flex-column flex-md-row gap-2 mt-3 mt-md-0">
              <Button
                variant="primary"
                // onClick={handleStartNewGame}
              >
                Nová Hra
              </Button>
              <Button variant="outline-primary" onClick={logout}>
                Odhlásenie
              </Button>
            </div>
          </Navbar.Collapse>
        </Navbar>
      </div>
    </header>
  );
};

export default Header;
