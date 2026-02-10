"use client";

import { useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { Navbar, Button } from "react-bootstrap";
import { useAuth } from "@/utilities/AuthContext";

import SceneBuilder from "./SceneBuilder";
import type { SceneConfig } from "./SceneBuilder";

const Header = () => {
  const { user, logout } = useAuth();

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
                <Button variant="primary" href="/marketplace">
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
