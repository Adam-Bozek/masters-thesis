"use client";

import { useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { Navbar, Button } from "react-bootstrap";
import { useAuth } from "@/utilities/AuthContext";

import SceneBuilder from "./SceneBuilder";
import type { SceneConfig } from "./SceneBuilder";

const Header = () => {
  const { user, logout } = useAuth();
  const [showScene, setShowScene] = useState(false);

  const config = {
    sound_path: "/sounds/testing/zoo/scene.mp3",
    pictures: [
      { path: "/images/1.jpg", display_time: "0:00", display_type: "insert" },
      { path: "/images/2.jpg", display_time: "0:23", display_type: "add" },
      { path: "/images/3.jpg", display_time: "1:00", display_type: "remove_all_and_add" },
    ],
  } as const satisfies SceneConfig;

  return (
    <>
      <header className="container my-4">
        <div className="glass w-100">
          <Navbar expand="md" className="py-3 px-3 mx-4">
            <Navbar.Brand className="me-auto">
              <h1 className="h3 m-0">Zdravíme {user?.firstName}!</h1>
            </Navbar.Brand>

            <Navbar.Toggle aria-controls="main-navbar" />

            <Navbar.Collapse id="main-navbar" className="justify-content-md-end">
              <div className="d-flex flex-column flex-md-row gap-2 mt-3 mt-md-0">
                <Button variant="primary" onClick={() => setShowScene(true)}>
                  Nová hra
                </Button>

                <Button variant="outline-primary" onClick={logout}>
                  Odhlásenie
                </Button>
              </div>
            </Navbar.Collapse>
          </Navbar>
        </div>
      </header>
    </>
  );
};

export default Header;
